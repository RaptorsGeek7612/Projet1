import "dotenv/config";
import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { deployTrexSuite, deployIdentityFor, type Artifact } from "./lib/deploy-suite";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Déploie une suite T-REX minimale sur Sepolia : registres + token, sans
 * module de conformité ni claim topic. isVerified() ne vérifie alors que
 * l'enregistrement de l'identité, ce qui suffit à obtenir un token réel et
 * indexable sans monter d'infrastructure de claim issuers.
 */

function loadArtifact(relPath: string): Artifact {
  const json = JSON.parse(
    readFileSync(join(__dirname, "../artifacts/src/contracts", relPath), "utf-8")
  );
  return { abi: json.abi, bytecode: json.bytecode };
}

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!rpcUrl || !privateKey) {
    throw new Error("SEPOLIA_RPC_URL et DEPLOYER_PRIVATE_KEY doivent être définis dans backend/.env");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(privateKey, provider);
  console.log("Déploiement depuis", deployer.address);

  const suite = await deployTrexSuite(deployer, loadArtifact);
  const { token, identityRegistry, tokenAddress, identityRegistryAddress, identityImplementationAuthorityAddress, deployBlock } =
    suite;
  console.log("Token:", tokenAddress);
  console.log("IdentityRegistry:", identityRegistryAddress);
  console.log("Bloc de déploiement:", deployBlock);

  // Porteur n°1 : le déployeur lui-même, pour pouvoir minter un solde de départ
  const deployerIdentity = await deployIdentityFor(deployer, loadArtifact, identityImplementationAuthorityAddress, deployer.address);
  await (await (identityRegistry as any).registerIdentity(deployer.address, await deployerIdentity.getAddress(), 250)).wait();

  const mintAmount = ethers.parseUnits("1000", 18);
  await (await (token as any).mint(deployer.address, mintAmount)).wait();
  console.log("1000 RPD mintés vers", deployer.address);

  // Le token T-REX démarre en pause : mint() passe, mais transfer() est bloqué tant
  // qu'un agent n'a pas explicitement dépausé.
  await (await (token as any).unpause()).wait();
  console.log("Token dépausé");

  // Porteur n°2 : wallet aléatoire jetable (recevoir ne coûte pas de gas, pas besoin de le financer)
  const secondHolder = ethers.Wallet.createRandom();
  const secondIdentity = await deployIdentityFor(
    deployer,
    loadArtifact,
    identityImplementationAuthorityAddress,
    secondHolder.address
  );
  await (await (identityRegistry as any).registerIdentity(secondHolder.address, await secondIdentity.getAddress(), 840)).wait();

  const transferAmount = ethers.parseUnits("100", 18);
  await (await (token as any).transfer(secondHolder.address, transferAmount)).wait();

  // Gel partiel pour exercer /registry/anomalies et l'audit des actions d'agent côté indexeur
  await (await (token as any).freezePartialTokens(secondHolder.address, ethers.parseUnits("20", 18))).wait();
  console.log("Deuxième porteur (jetable, clé privée non conservée) :", secondHolder.address);

  const summary = {
    network: "sepolia",
    tokenAddress,
    identityRegistryAddress,
    startBlock: deployBlock,
    deployer: deployer.address,
    secondHolder: secondHolder.address,
  };
  writeFileSync(join(__dirname, "../deployed.json"), JSON.stringify(summary, null, 2));
  console.log("\nRésumé écrit dans backend/deployed.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
