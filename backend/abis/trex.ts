/**
 * ABIs réduites aux événements indexés.
 *
 * On ne dépend pas des artefacts compilés de T-REX : moins de couplage à une
 * version, et un diff lisible quand un événement change de forme.
 *
 * ⚠️ Vérifie ces signatures contre la version du token que tu indexes.
 * Un paramètre `indexed` en trop ou en moins et l'événement n'est jamais
 * capté — silencieusement, sans erreur.
 */

export const TokenAbi = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AddressFrozen",
    inputs: [
      { name: "userAddress", type: "address", indexed: true },
      { name: "isFrozen", type: "bool", indexed: true },
      { name: "owner", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "TokensFrozen",
    inputs: [
      { name: "userAddress", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "TokensUnfrozen",
    inputs: [
      { name: "userAddress", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "RecoverySuccess",
    inputs: [
      { name: "lostWallet", type: "address", indexed: true },
      { name: "newWallet", type: "address", indexed: true },
      { name: "investorOnchainID", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Paused",
    inputs: [{ name: "userAddress", type: "address", indexed: false }],
  },
  {
    type: "event",
    name: "Unpaused",
    inputs: [{ name: "userAddress", type: "address", indexed: false }],
  },
  // Lecture ponctuelle depuis les handlers
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

export const IdentityRegistryAbi = [
  {
    type: "event",
    name: "IdentityRegistered",
    inputs: [
      { name: "investorAddress", type: "address", indexed: true },
      { name: "identity", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "IdentityRemoved",
    inputs: [
      { name: "investorAddress", type: "address", indexed: true },
      { name: "identity", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "IdentityUpdated",
    inputs: [
      { name: "oldIdentity", type: "address", indexed: true },
      { name: "newIdentity", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "CountryUpdated",
    inputs: [
      { name: "investorAddress", type: "address", indexed: true },
      { name: "country", type: "uint16", indexed: true },
    ],
  },
] as const;
