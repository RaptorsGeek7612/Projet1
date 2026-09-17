import { onchainTable, index, relations } from "ponder";

/**
 * Le schéma reflète ce qu'un émetteur demande, pas ce que la chaîne émet.
 *
 * La différence est le cœur du projet. Un indexeur de développeur stocke des
 * événements. Un registre de porteurs répond à : qui détient quoi, depuis
 * quand, dans quel pays, et combien est gelé. Ce sont deux modèles de données
 * différents, et le second se construit en agrégeant le premier au fil de l'eau.
 */

/** Un porteur = une adresse au solde non nul, plus son historique. */
export const holder = onchainTable(
  "holder",
  (t) => ({
    address: t.hex().primaryKey(),

    // Solde total, gelé inclus — c'est la définition du registre.
    balance: t.bigint().notNull().default(0n),
    // Part gelée partiellement, non transférable.
    frozenBalance: t.bigint().notNull().default(0n),
    // Adresse entièrement gelée par un agent.
    isFrozen: t.boolean().notNull().default(false),

    // Couche identité, alimentée par l'IdentityRegistry.
    identity: t.hex(),
    country: t.integer(),

    firstSeenAt: t.integer(),
    lastActivityAt: t.integer(),
    transferCount: t.integer().notNull().default(0),

    // Trace d'une récupération de portefeuille.
    recoveredFrom: t.hex(),
  }),
  (table) => ({
    byBalance: index().on(table.balance),
    byCountry: index().on(table.country),
  })
);

/** État agrégé du token. Une seule ligne en pratique. */
export const tokenState = onchainTable("token_state", (t) => ({
  address: t.hex().primaryKey(),
  name: t.text(),
  symbol: t.text(),
  decimals: t.integer(),
  totalSupply: t.bigint().notNull().default(0n),
  holderCount: t.integer().notNull().default(0),
  frozenHolderCount: t.integer().notNull().default(0),
  isPaused: t.boolean().notNull().default(false),
  lastBlock: t.integer(),
}));

/** Répartition par pays — la vue que réclament les contraintes d'offre. */
export const countryStat = onchainTable("country_stat", (t) => ({
  country: t.integer().primaryKey(),
  holderCount: t.integer().notNull().default(0),
  balance: t.bigint().notNull().default(0n),
}));

/** Journal des mouvements. */
export const transferEvent = onchainTable(
  "transfer_event",
  (t) => ({
    id: t.text().primaryKey(), // txHash-logIndex
    from: t.hex().notNull(),
    to: t.hex().notNull(),
    value: t.bigint().notNull(),
    // mint, burn, transfer, recovery
    kind: t.text().notNull(),
    blockNumber: t.integer().notNull(),
    timestamp: t.integer().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    byTime: index().on(table.timestamp),
    byFrom: index().on(table.from),
    byTo: index().on(table.to),
  })
);

/** Journal des actions d'agent — la piste d'audit que le régulateur regarde. */
export const agentAction = onchainTable(
  "agent_action",
  (t) => ({
    id: t.text().primaryKey(),
    // freeze, unfreeze, partialFreeze, partialUnfreeze, recovery, pause, unpause
    kind: t.text().notNull(),
    subject: t.hex(),
    amount: t.bigint(),
    counterparty: t.hex(),
    blockNumber: t.integer().notNull(),
    timestamp: t.integer().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    byTime: index().on(table.timestamp),
    byKind: index().on(table.kind),
  })
);

/** Historique de la couche identité. */
export const identityEvent = onchainTable(
  "identity_event",
  (t) => ({
    id: t.text().primaryKey(),
    // registered, removed, updated, countryUpdated
    kind: t.text().notNull(),
    investor: t.hex(),
    identity: t.hex(),
    previousIdentity: t.hex(),
    country: t.integer(),
    blockNumber: t.integer().notNull(),
    timestamp: t.integer().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    byInvestor: index().on(table.investor),
  })
);

export const holderRelations = relations(holder, ({ many }) => ({
  transfersOut: many(transferEvent),
}));
