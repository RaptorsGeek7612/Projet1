import { ponder } from "ponder:registry";
import schema from "ponder:schema";

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

function eventId(ev: { transaction: { hash: string }; log: { logIndex: number } }) {
  return `${ev.transaction.hash}-${ev.log.logIndex}`;
}

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
  const next = previous + delta;

  const becameHolder = previous === 0n && next > 0n;
  const leftRegister = previous > 0n && next === 0n;

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

ponder.on("Token:Transfer", async ({ event, context }) => {
  const { from, to, value } = event.args;
  const ts = Number(event.block.timestamp);
  const token = event.log.address as `0x${string}`;

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

  await context.db
    .insert(schema.holder)
    .values({ address: userAddress, isFrozen })
    .onConflictDoUpdate(() => ({ isFrozen }));

  await context.db
    .insert(schema.tokenState)
    .values({ address: token, frozenHolderCount: isFrozen ? 1 : 0 })
    .onConflictDoUpdate((row: any) => ({
      frozenHolderCount: Math.max(0, row.frozenHolderCount + (isFrozen ? 1 : -1)),
    }));
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
  await context.db
    .insert(schema.holder)
    .values({ address: newWallet, identity: investorOnchainID, recoveredFrom: lostWallet })
    .onConflictDoUpdate(() => ({
      identity: investorOnchainID,
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

  const before = await context.db.find(schema.holder, { address: investorAddress });

  await context.db
    .insert(schema.holder)
    .values({ address: investorAddress, country: c })
    .onConflictDoUpdate(() => ({ country: c }));

  // Déplacer le porteur d'un pays à l'autre dans les agrégats.
  if (before && before.country != null && before.country !== c && before.balance > 0n) {
    await context.db
      .insert(schema.countryStat)
      .values({ country: before.country, holderCount: 0, balance: 0n })
      .onConflictDoUpdate((row: any) => ({
        holderCount: Math.max(0, row.holderCount - 1),
        balance: row.balance > before.balance ? row.balance - before.balance : 0n,
      }));
  }
  if (before && before.balance > 0n && before.country !== c) {
    await context.db
      .insert(schema.countryStat)
      .values({ country: c, holderCount: 1, balance: before.balance })
      .onConflictDoUpdate((row: any) => ({
        holderCount: row.holderCount + 1,
        balance: row.balance + before.balance,
      }));
  }
});
