import { createConfig } from "ponder";
import { TokenAbi, IdentityRegistryAbi } from "./abis/trex";

/**
 * ⚠️ API Ponder : ce fichier suit la forme `chains` / `chain` (Ponder récent).
 * Les versions antérieures utilisaient `networks` / `network` et `transport`.
 * Si `ponder dev` refuse la config, compare avec la doc de la version que
 * npm a installée avant de chercher plus loin.
 */

const TOKEN = process.env.TOKEN_ADDRESS as `0x${string}`;
const IDENTITY_REGISTRY = process.env.IDENTITY_REGISTRY_ADDRESS as `0x${string}`;
const START_BLOCK = Number(process.env.START_BLOCK ?? 0);

export default createConfig({
  chains: {
    sepolia: {
      id: 11155111,
      rpc: process.env.PONDER_RPC_URL_11155111,
    },
  },
  contracts: {
    Token: {
      abi: TokenAbi,
      chain: "sepolia",
      address: TOKEN,
      // Le bloc de déploiement du token, pas 0 : indexer depuis la genèse
      // sur un RPC gratuit épuise le quota avant d'atteindre le premier mint.
      startBlock: START_BLOCK,
    },
    IdentityRegistry: {
      abi: IdentityRegistryAbi,
      chain: "sepolia",
      address: IDENTITY_REGISTRY,
      startBlock: START_BLOCK,
    },
  },
});
