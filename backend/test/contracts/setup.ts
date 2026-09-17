import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Vitest globalSetup : démarre un nœud Hardhat local pour la durée des tests
 * de contrats, et l'arrête à la fin. Évite de dépendre de Sepolia pour
 * vérifier les hypothèses de comportement du contrat (pause par défaut,
 * événements redondants sur AddressFrozen, etc.).
 */

let node: ChildProcess | undefined;

async function waitForNode(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
      });
      if (res.ok) return;
    } catch {
      // pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Nœud Hardhat non disponible sur ${url} après ${timeoutMs}ms`);
}

export async function setup() {
  const cwd = fileURLToPath(new URL("../..", import.meta.url));
  const hardhatBin = fileURLToPath(new URL("../../node_modules/.bin/hardhat", import.meta.url));
  node = spawn(hardhatBin, ["node", "--port", "8545"], {
    cwd,
    stdio: "ignore",
  });
  await waitForNode("http://127.0.0.1:8545", 20000);
}

export async function teardown() {
  node?.kill();
}
