import { db } from "ponder:api";
import schema from "ponder:schema";
import { Hono } from "hono";
import { desc, eq, gt, sql } from "ponder";
import { countryName } from "../countries";

/**
 * Les routes correspondent aux questions qu'un émetteur pose réellement.
 * Pas à la structure des tables, et surtout pas à la structure des événements.
 *
 * Ponder expose déjà une API GraphQL et SQL générée. Ces routes n'existent
 * que parce qu'un opérationnel ne veut pas écrire de requête : il veut une
 * URL qui rend le registre.
 */

const app = new Hono();

/** Le registre des porteurs, trié par encours. La vue par défaut. */
app.get("/registry", async (c) => {
  const limit = Number(c.req.query("limit") ?? 200);
  const rows = await db
    .select()
    .from(schema.holder)
    .where(gt(schema.holder.balance, 0n))
    .orderBy(desc(schema.holder.balance))
    .limit(limit);

  return c.json({
    holders: rows.map((h) => ({
      address: h.address,
      balance: h.balance.toString(),
      frozenBalance: h.frozenBalance.toString(),
      transferable: (h.isFrozen ? 0n : h.balance - h.frozenBalance).toString(),
      isFrozen: h.isFrozen,
      identity: h.identity,
      country: h.country,
      countryName: h.country != null ? countryName(h.country) : null,
      firstSeenAt: h.firstSeenAt,
      lastActivityAt: h.lastActivityAt,
      transferCount: h.transferCount,
    })),
    count: rows.length,
  });
});

/** Répartition par pays — la vue que réclament les contraintes d'offre. */
app.get("/registry/by-country", async (c) => {
  const rows = await db
    .select()
    .from(schema.countryStat)
    .where(gt(schema.countryStat.holderCount, 0))
    .orderBy(desc(schema.countryStat.holderCount));

  return c.json(
    rows.map((r) => ({
      country: r.country,
      countryName: countryName(r.country),
      holderCount: r.holderCount,
      balance: r.balance.toString(),
    }))
  );
});

/** Anomalies : porteur au solde non nul sans identité enregistrée. */
app.get("/registry/anomalies", async (c) => {
  const orphans = await db
    .select()
    .from(schema.holder)
    .where(sql`${schema.holder.balance} > 0 AND ${schema.holder.identity} IS NULL`);

  const noCountry = await db
    .select()
    .from(schema.holder)
    .where(sql`${schema.holder.balance} > 0 AND ${schema.holder.country} IS NULL`);

  return c.json({
    // Un solde sans identité signifie généralement que le porteur a été radié
    // du registre après coup. C'est légitime, mais ça doit être vu.
    holdersWithoutIdentity: orphans.map((h) => h.address),
    holdersWithoutCountry: noCountry.map((h) => h.address),
  });
});

/** Fiche d'un porteur, avec son historique. */
app.get("/holder/:address", async (c) => {
  const address = c.req.param("address").toLowerCase() as `0x${string}`;

  const h = await db.select().from(schema.holder).where(eq(schema.holder.address, address));
  if (h.length === 0) return c.json({ error: "porteur inconnu" }, 404);

  const outgoing = await db
    .select()
    .from(schema.transferEvent)
    .where(eq(schema.transferEvent.from, address))
    .orderBy(desc(schema.transferEvent.timestamp))
    .limit(50);

  const incoming = await db
    .select()
    .from(schema.transferEvent)
    .where(eq(schema.transferEvent.to, address))
    .orderBy(desc(schema.transferEvent.timestamp))
    .limit(50);

  const actions = await db
    .select()
    .from(schema.agentAction)
    .where(eq(schema.agentAction.subject, address))
    .orderBy(desc(schema.agentAction.timestamp));

  const row = h[0]!;
  return c.json({
    address: row.address,
    balance: row.balance.toString(),
    frozenBalance: row.frozenBalance.toString(),
    isFrozen: row.isFrozen,
    identity: row.identity,
    country: row.country,
    countryName: row.country != null ? countryName(row.country) : null,
    recoveredFrom: row.recoveredFrom,
    movements: [...outgoing, ...incoming]
      .sort((a, b) => b.timestamp - a.timestamp)
      .map((t) => ({
        kind: t.kind,
        direction: t.from === address ? "out" : "in",
        counterparty: t.from === address ? t.to : t.from,
        value: t.value.toString(),
        timestamp: t.timestamp,
        txHash: t.txHash,
      })),
    agentActions: actions.map((a) => ({
      kind: a.kind,
      amount: a.amount?.toString() ?? null,
      counterparty: a.counterparty,
      timestamp: a.timestamp,
      txHash: a.txHash,
    })),
  });
});

/** Piste d'audit des actions d'agent — ce qu'un régulateur demanderait. */
app.get("/audit/agent-actions", async (c) => {
  const rows = await db
    .select()
    .from(schema.agentAction)
    .orderBy(desc(schema.agentAction.timestamp))
    .limit(Number(c.req.query("limit") ?? 100));

  return c.json(
    rows.map((a) => ({
      kind: a.kind,
      subject: a.subject,
      counterparty: a.counterparty,
      amount: a.amount?.toString() ?? null,
      timestamp: a.timestamp,
      blockNumber: a.blockNumber,
      txHash: a.txHash,
    }))
  );
});

/** Vue synthétique du token. */
app.get("/stats", async (c) => {
  const rows = await db.select().from(schema.tokenState).limit(1);
  if (rows.length === 0) return c.json({ error: "aucune donnée indexée" }, 404);
  const t = rows[0]!;
  return c.json({
    token: t.address,
    name: t.name,
    symbol: t.symbol,
    decimals: t.decimals,
    totalSupply: t.totalSupply.toString(),
    holderCount: t.holderCount,
    frozenHolderCount: t.frozenHolderCount,
    isPaused: t.isPaused,
    lastIndexedBlock: t.lastBlock,
  });
});

export default app;
