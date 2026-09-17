import { ponder } from "ponder:registry";
import schema from "ponder:schema";
import { TokenAbi } from "../abis/trex";
import {
  classifyBalanceTransition,
  classifyFreezeTransition,
  computeCountryMove,
  decodeRegisteredCountry,
  eventId,
} from "./logic";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

/**
 * Reconstruction du registre.
 *
 * Principe : le solde d'un porteur n'est jamais lu on-chain, il est dérivé de
 * la somme des Transfer. C'est plus rapide, ça évite un appel RPC par
 * événement, et ça reste exact tant qu'aucun mouvement n'échappe aux logs.
 *
 * Le compteur de porteurs suit la même règle que le module de conformité :
 * un porteur naît quand son solde passe de 0 à non nul, et disparaît à
 * l'inverse. Si l'indexeur et le contrat divergent sur ce nombre, c'est
 * l'indexeur qui a tort — et c'est exactement ce qu'un test de réconciliation
 * doit détecter.
 */

/** Applique un delta de solde et maintient tous les compteurs dérivés. */
async function applyDelta(
  context: any,
  address: `0x${string}`,
  delta: bigint,
  timestamp: number,
  tokenAddress: `0x${string}`
) {
  if (address === ZERO || delta === 0n) return;

  const before = await context.db.find(schema.holder, { address });
  const previous = before?.balance ?? 0n;
  const { next, becameHolder, leftRegister } = classifyBalanceTransition(previous, delta);

  await context.db
    .insert(schema.holder)
    .values({
      address,
      balance: next,
      firstSeenAt: timestamp,
      lastActivityAt: timestamp,
      transferCount: 1,
    })
    .onConflictDoUpdate((row: any) => ({
      balance: row.balance + delta,
      // Le row peut déjà exister (identité enregistrée avant tout mouvement) :
      // sans ce fallback, firstSeenAt resterait null pour ces porteurs.
      firstSeenAt: row.firstSeenAt ?? timestamp,
      lastActivityAt: timestamp,
      transferCount: row.transferCount + 1,
    }));

  if (becameHolder || leftRegister) {
    const step = becameHolder ? 1 : -1;

    await context.db
      .insert(schema.tokenState)
      .values({ address: tokenAddress, holderCount: step > 0 ? 1 : 0 })
      .onConflictDoUpdate((row: any) => ({
        holderCount: Math.max(0, row.holderCount + step),
      }));

    // La répartition par pays suit le même cycle de vie.
    const country = before?.country;
    if (country != null) {
      await context.db
        .insert(schema.countryStat)
        .values({ country, holderCount: step > 0 ? 1 : 0, balance: 0n })
        .onConflictDoUpdate((row: any) => ({
          holderCount: Math.max(0, row.holderCount + step),
        }));
    }
  }

  // Encours par pays, indépendamment du franchissement de seuil.
  const country = before?.country;
  if (country != null) {
    await context.db
      .insert(schema.countryStat)
      .values({ country, holderCount: 0, balance: delta > 0n ? delta : 0n })
      .onConflictDoUpdate((row: any) => ({
        balance: row.balance + delta > 0n ? row.balance + delta : 0n,
      }));
  }
}

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

/**
 * name/symbol/decimals ne changent jamais après déploiement : un seul appel
 * RPC suffit, au premier événement vu pour ce token. Le garde sur `name`
 * évite de refaire ces trois lectures à chaque Transfer.
 */
async function ensureTokenMetadata(context: any, token: `0x${string}`) {
  const existing = await context.db.find(schema.tokenState, { address: token });
  if (existing?.name != null) return;

  const [name, symbol, decimals] = await Promise.all([
    context.client.readContract({ abi: TokenAbi, address: token, functionName: "name" }),
    context.client.readContract({ abi: TokenAbi, address: token, functionName: "symbol" }),
    context.client.readContract({ abi: TokenAbi, address: token, functionName: "decimals" }),
  ]);

  await context.db
    .insert(schema.tokenState)
    .values({ address: token, name, symbol, decimals })
    .onConflictDoUpdate(() => ({ name, symbol, decimals }));
}

ponder.on("Token:Transfer", async ({ event, context }) => {
  const { from, to, value } = event.args;
  const ts = Number(event.block.timestamp);
  const token = event.log.address as `0x${string}`;

  await ensureTokenMetadata(context, token);

  const kind = from === ZERO ? "mint" : to === ZERO ? "burn" : "transfer";

  await context.db.insert(schema.transferEvent).values({
    id: eventId(event as any),
    from,
    to,
    value,
    kind,
    blockNumber: Number(event.block.number),
    timestamp: ts,
    txHash: event.transaction.hash,
  });

  await applyDelta(context, from, -value, ts, token);
  await applyDelta(context, to, value, ts, token);

  const supplyDelta = kind === "mint" ? value : kind === "burn" ? -value : 0n;

  await context.db
    .insert(schema.tokenState)
    .values({
      address: token,
      totalSupply: supplyDelta > 0n ? supplyDelta : 0n,
      lastBlock: Number(event.block.number),
    })
    .onConflictDoUpdate((row: any) => ({
      totalSupply: row.totalSupply + supplyDelta,
      lastBlock: Number(event.block.number),
    }));
});

ponder.on("Token:AddressFrozen", async ({ event, context }) => {
  const { userAddress, isFrozen, owner } = event.args;
  const token = event.log.address as `0x${string}`;

  await context.db.insert(schema.agentAction).values({
    id: eventId(event as any),
    kind: isFrozen ? "freeze" : "unfreeze",
    subject: userAddress,
    counterparty: owner,
    blockNumber: Number(event.block.number),
    timestamp: Number(event.block.timestamp),
    txHash: event.transaction.hash,
  });

  // Le contrat émet AddressFrozen même quand l'état ne change pas (un agent
  // qui gèle une adresse déjà gelée). Sans ce garde-fou, frozenHolderCount
  // dérive à chaque appel redondant au lieu de suivre une vraie transition.
  const before = await context.db.find(schema.holder, { address: userAddress });
  const { changed, step } = classifyFreezeTransition(before?.isFrozen ?? false, isFrozen);

  await context.db
    .insert(schema.holder)
    .values({ address: userAddress, isFrozen })
    .onConflictDoUpdate(() => ({ isFrozen }));

  if (changed) {
    await context.db
      .insert(schema.tokenState)
      .values({ address: token, frozenHolderCount: step > 0 ? 1 : 0 })
      .onConflictDoUpdate((row: any) => ({
        frozenHolderCount: Math.max(0, row.frozenHolderCount + step),
      }));
  }
});

ponder.on("Token:TokensFrozen", async ({ event, context }) => {
  const { userAddress, amount } = event.args;
  await context.db.insert(schema.agentAction).values({
    id: eventId(event as any),
    kind: "partialFreeze",
    subject: userAddress,
    amount,
    blockNumber: Number(event.block.number),
    timestamp: Number(event.block.timestamp),
    txHash: event.transaction.hash,
  });
  await context.db
    .insert(schema.holder)
    .values({ address: userAddress, frozenBalance: amount })
    .onConflictDoUpdate((row: any) => ({ frozenBalance: row.frozenBalance + amount }));
});

ponder.on("Token:TokensUnfrozen", async ({ event, context }) => {
  const { userAddress, amount } = event.args;
  await context.db.insert(schema.agentAction).values({
    id: eventId(event as any),
    kind: "partialUnfreeze",
    subject: userAddress,
    amount,
    blockNumber: Number(event.block.number),
    timestamp: Number(event.block.timestamp),
    txHash: event.transaction.hash,
  });
  await context.db
    .insert(schema.holder)
    .values({ address: userAddress, frozenBalance: 0n })
    .onConflictDoUpdate((row: any) => ({
      frozenBalance: row.frozenBalance > amount ? row.frozenBalance - amount : 0n,
    }));
});

ponder.on("Token:RecoverySuccess", async ({ event, context }) => {
  const { lostWallet, newWallet, investorOnchainID } = event.args;

  await context.db.insert(schema.agentAction).values({
    id: eventId(event as any),
    kind: "recovery",
    subject: lostWallet,
    counterparty: newWallet,
    blockNumber: Number(event.block.number),
    timestamp: Number(event.block.timestamp),
    txHash: event.transaction.hash,
  });

  // Le transfert de solde arrive par l'événement Transfer associé.
  // Ici on ne conserve que le lien entre les deux portefeuilles, sans quoi
  // le registre montre un porteur sorti et un porteur entré sans rapport.
  // Le pays doit aussi migrer : sans ça, le nouveau portefeuille ressort
  // comme une anomalie "sans pays" alors que son identité est déjà connue.
  const lost = await context.db.find(schema.holder, { address: lostWallet });

  await context.db
    .insert(schema.holder)
    .values({
      address: newWallet,
      identity: investorOnchainID,
      country: lost?.country,
      recoveredFrom: lostWallet,
    })
    .onConflictDoUpdate(() => ({
      identity: investorOnchainID,
      country: lost?.country,
      recoveredFrom: lostWallet,
    }));
});

ponder.on("Token:Paused", async ({ event, context }) => {
  await context.db
    .insert(schema.tokenState)
    .values({ address: event.log.address as `0x${string}`, isPaused: true })
    .onConflictDoUpdate(() => ({ isPaused: true }));
});

ponder.on("Token:Unpaused", async ({ event, context }) => {
  await context.db
    .insert(schema.tokenState)
    .values({ address: event.log.address as `0x${string}`, isPaused: false })
    .onConflictDoUpdate(() => ({ isPaused: false }));
});

// ---------------------------------------------------------------------------
// IdentityRegistry
// ---------------------------------------------------------------------------

ponder.on("IdentityRegistry:IdentityRegistered", async ({ event, context }) => {
  const { investorAddress, identity } = event.args;
  await context.db.insert(schema.identityEvent).values({
    id: eventId(event as any),
    kind: "registered",
    investor: investorAddress,
    identity,
    blockNumber: Number(event.block.number),
    timestamp: Number(event.block.timestamp),
    txHash: event.transaction.hash,
  });
  await context.db
    .insert(schema.holder)
    .values({ address: investorAddress, identity })
    .onConflictDoUpdate(() => ({ identity }));

  // registerIdentity()/batchRegisterIdentity() écrivent le pays dans le storage
  // sans jamais l'émettre en événement (seul IdentityRegistered(address,identity)
  // sort). Le calldata de la transaction est la seule source disponible.
  const country = decodeRegisteredCountry(event.transaction.input, investorAddress);
  if (country != null) {
    await setHolderCountry(context, investorAddress, country);
  }
});

ponder.on("IdentityRegistry:IdentityRemoved", async ({ event, context }) => {
  const { investorAddress, identity } = event.args;
  await context.db.insert(schema.identityEvent).values({
    id: eventId(event as any),
    kind: "removed",
    investor: investorAddress,
    identity,
    blockNumber: Number(event.block.number),
    timestamp: Number(event.block.timestamp),
    txHash: event.transaction.hash,
  });
  // On ne supprime pas la ligne : un porteur radié du registre d'identités
  // peut conserver un solde, et c'est précisément l'anomalie à voir.
  await context.db
    .insert(schema.holder)
    .values({ address: investorAddress, identity: null })
    .onConflictDoUpdate(() => ({ identity: null }));
});

/** Affecte (ou déplace) le pays d'un porteur et tient les agrégats countryStat à jour. */
async function setHolderCountry(context: any, address: `0x${string}`, c: number) {
  const before = await context.db.find(schema.holder, { address });

  await context.db
    .insert(schema.holder)
    .values({ address, country: c })
    .onConflictDoUpdate(() => ({ country: c }));

  const move = computeCountryMove(before, c);

  if (move.from) {
    await context.db
      .insert(schema.countryStat)
      .values({ country: move.from.country, holderCount: 0, balance: 0n })
      .onConflictDoUpdate((row: any) => ({
        holderCount: Math.max(0, row.holderCount - 1),
        balance: row.balance > move.from!.balance ? row.balance - move.from!.balance : 0n,
      }));
  }
  if (move.to) {
    await context.db
      .insert(schema.countryStat)
      .values({ country: move.to.country, holderCount: 1, balance: move.to.balance })
      .onConflictDoUpdate((row: any) => ({
        holderCount: row.holderCount + 1,
        balance: row.balance + move.to!.balance,
      }));
  }
}

ponder.on("IdentityRegistry:CountryUpdated", async ({ event, context }) => {
  const { investorAddress, country } = event.args;
  const c = Number(country);

  await context.db.insert(schema.identityEvent).values({
    id: eventId(event as any),
    kind: "countryUpdated",
    investor: investorAddress,
    country: c,
    blockNumber: Number(event.block.number),
    timestamp: Number(event.block.timestamp),
    txHash: event.transaction.hash,
  });

  await setHolderCountry(context, investorAddress, c);
});
