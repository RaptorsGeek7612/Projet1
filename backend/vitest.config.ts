import { defineConfig } from "vitest/config";

/** Tests unitaires rapides (logique pure, sans réseau). Les tests de
 * contrats (plus lents, nœud Hardhat local) vivent dans leur propre config :
 * voir vitest.contracts.config.ts / `pnpm test:contracts`. */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
