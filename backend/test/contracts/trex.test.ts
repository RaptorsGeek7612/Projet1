import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";
import { beforeAll, describe, expect, it } from "vitest";
import { deployIdentityFor, deployTrexSuite, type Artifact } from "../../scripts/lib/deploy-suite";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadArtifact(relPath: string): Artifact {
  const json = JSON.parse(readFileSync(join(__dirname, "../../artifacts/src/contracts", relPath), "utf-8"));
  return { abi: json.abi, bytecode: json.bytecode };
}

// Compte #0 par défaut du nœud Hardhat local — clé bien connue, jamais utilisée
// ailleurs qu'en local, aucun rapport avec les clés de déploiement Sepolia.
const DEPLOYER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/**
 * ethers.NonceManager mémorise un nonce optimiste et ne le resynchronise
 * jamais après un envoi qui échoue : une seule divergence casse tout le
 * reste de la suite. Ce wallet redemande le nonce confirmé ("latest") à
 * chaque transaction — plus lent, mais fiable puisque tout est strictement
 * séquentiel ici (chaque envoi est `wait()` avant le suivant).
 */
class LatestNonceWallet extends ethers.Wallet {
  override async getNonce(): Promise<number> {
    return super.getNonce("latest");
  }
}

/**
 * Vérifie contre un vrai déploiement local (pas de mock) les hypothèses de
 * comportement du contrat T-REX que l'indexeur backend/src/logic.ts doit
 * compenser. Si l'une de ces hypothèses cesse d'être vraie dans une future
 * version du contrat, ce test échoue — pas seulement l'indexeur en silence.
 *
 * Les tests s'enchaînent sur le MÊME déploiement (beforeAll, pas beforeEach) :
 * plus rapide, et chaque test avance l'état (dépause, etc.) pour le suivant,
 * comme le ferait une vraie séquence d'opérations sur un token en production.
 */
describe("Suite T-REX (nœud Hardhat local)", () => {
  let provider: ethers.JsonRpcProvider;
  let deployerAddress: string;
  let deployer: LatestNonceWallet;
  let suite: Awaited<ReturnType<typeof deployTrexSuite>>;

  beforeAll(async () => {
    // cacheTimeout: -1 — par défaut, AbstractProvider met en cache CHAQUE
    // lecture (dont getTransactionCount) pendant 250ms. Hardhat mine en
    // quelques millisecondes : sans ça, deux lectures de nonce séparées par
    // une transaction confirmée renvoient la même valeur périmée, et la
    // transaction suivante réutilise un nonce déjà consommé.
    provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545", undefined, { cacheTimeout: -1 });
    deployer = new LatestNonceWallet(DEPLOYER_PRIVATE_KEY, provider);
    deployerAddress = deployer.address;
    suite = await deployTrexSuite(deployer, loadArtifact);
  });

  it("démarre en pause", async () => {
    expect(await (suite.token as any).paused()).toBe(true);
  });

  it("mint() passe malgré la pause, mais transfer() est bloqué jusqu'à unpause()", async () => {
    const deployerIdentity = await deployIdentityFor(
      deployer,
      loadArtifact,
      suite.identityImplementationAuthorityAddress,
      deployerAddress
    );
    await (await (suite.identityRegistry as any).registerIdentity(deployerAddress, await deployerIdentity.getAddress(), 250)).wait();

    await (await (suite.token as any).mint(deployerAddress, ethers.parseUnits("1000", 18))).wait();
    expect(await (suite.token as any).balanceOf(deployerAddress)).toBe(ethers.parseUnits("1000", 18));

    const other = ethers.Wallet.createRandom().connect(provider);
    await expect((suite.token as any).transfer(other.address, 1n)).rejects.toThrow();

    await (await (suite.token as any).unpause()).wait();
    // Le destinataire doit lui aussi être vérifié pour recevoir un transfert.
    const otherIdentity = await deployIdentityFor(deployer, loadArtifact, suite.identityImplementationAuthorityAddress, other.address);
    await (await (suite.identityRegistry as any).registerIdentity(other.address, await otherIdentity.getAddress(), 840)).wait();
    await (await (suite.token as any).transfer(other.address, ethers.parseUnits("10", 18))).wait();
    expect(await (suite.token as any).balanceOf(other.address)).toBe(ethers.parseUnits("10", 18));
  });

  it("registerIdentity() n'émet PAS d'événement CountryUpdated — seul IdentityRegistered sort", async () => {
    // C'est exactement l'hypothèse que backend/src/logic.ts::decodeRegisteredCountry
    // compense en lisant le calldata plutôt que les événements.
    const holder = ethers.Wallet.createRandom().connect(provider);
    const identity = await deployIdentityFor(deployer, loadArtifact, suite.identityImplementationAuthorityAddress, holder.address);

    const tx = await (suite.identityRegistry as any).registerIdentity(holder.address, await identity.getAddress(), 124);
    const receipt = await tx.wait();

    const iface = new ethers.Interface(loadArtifact("registry/interface/IIdentityRegistry.sol/IIdentityRegistry.json").abi);
    const eventNames = receipt.logs
      .map((log: any) => {
        try {
          return iface.parseLog(log)?.name;
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    expect(eventNames).toContain("IdentityRegistered");
    expect(eventNames).not.toContain("CountryUpdated");
  });

  it("setAddressFrozen() réémet AddressFrozen même sans changement d'état (appel redondant)", async () => {
    // C'est exactement l'hypothèse que backend/src/logic.ts::classifyFreezeTransition
    // compense : sans ce garde-fou côté indexeur, frozenHolderCount dériverait.
    const holder = ethers.Wallet.createRandom().connect(provider);
    const identity = await deployIdentityFor(deployer, loadArtifact, suite.identityImplementationAuthorityAddress, holder.address);
    await (await (suite.identityRegistry as any).registerIdentity(holder.address, await identity.getAddress(), 250)).wait();

    const tx1 = await (suite.token as any).setAddressFrozen(holder.address, true);
    const receipt1 = await tx1.wait();
    const tx2 = await (suite.token as any).setAddressFrozen(holder.address, true);
    const receipt2 = await tx2.wait();

    const iface = new ethers.Interface(loadArtifact("token/IToken.sol/IToken.json").abi);
    const countAddressFrozenEvents = (receipt: any) =>
      receipt.logs.filter((log: any) => {
        try {
          return iface.parseLog(log)?.name === "AddressFrozen";
        } catch {
          return false;
        }
      }).length;

    expect(countAddressFrozenEvents(receipt1)).toBe(1);
    expect(countAddressFrozenEvents(receipt2)).toBe(1);
    expect(await (suite.token as any).isFrozen(holder.address)).toBe(true);
  });

  it("freezePartialTokens() refuse de geler plus que le solde disponible", async () => {
    const holder = ethers.Wallet.createRandom().connect(provider);
    const identity = await deployIdentityFor(deployer, loadArtifact, suite.identityImplementationAuthorityAddress, holder.address);
    await (await (suite.identityRegistry as any).registerIdentity(holder.address, await identity.getAddress(), 250)).wait();

    await (await (suite.token as any).mint(holder.address, ethers.parseUnits("50", 18))).wait();

    await expect((suite.token as any).freezePartialTokens(holder.address, ethers.parseUnits("51", 18))).rejects.toThrow();

    await (await (suite.token as any).freezePartialTokens(holder.address, ethers.parseUnits("20", 18))).wait();
    expect(await (suite.token as any).getFrozenTokens(holder.address)).toBe(ethers.parseUnits("20", 18));
  });
});
