import "dotenv/config";
import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Complète un déploiement interrompu par le pause-by-default du token T-REX :
 * dépause, enregistre un deuxième porteur, transfère, gèle une partie de son solde.
 * Ne redéploie rien de la suite principale (déjà en place, adresses en dur ci-dessous).
 */

const TOKEN_ADDRESS = "0x2C75bB41c4B90Da410D39D7413304922Ddb497D9";
const IR_ADDRESS = "0xafe7308c10F26C6cC5e0d83938dc10D421704c23";
const START_BLOCK = 11722735;

type Artifact = { abi: ethers.InterfaceAbi; bytecode: string };

function loadArtifact(relPath: string): Artifact {
  const json = JSON.parse(readFileSync(join(__dirname, "../artifacts/src/contracts", relPath), "utf-8"));
  return { abi: json.abi, bytecode: json.bytecode };
}

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!rpcUrl || !privateKey) throw new Error("SEPOLIA_RPC_URL et DEPLOYER_PRIVATE_KEY doivent être définis dans backend/.env");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(privateKey, provider);

  async function deploy(artifact: Artifact, args: unknown[] = []) {
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    return contract;
  }

  const token = new ethers.Contract(TOKEN_ADDRESS, loadArtifact("token/Token.sol/Token.json").abi, deployer);
  const identityRegistry = new ethers.Contract(
    IR_ADDRESS,
    loadArtifact("registry/implementation/IdentityRegistry.sol/IdentityRegistry.json").abi,
    deployer
  );

  const isPaused = await (token as any).paused();
  if (isPaused) {
    await (await (token as any).unpause()).wait();
    console.log("Token dépausé");
  }

  // IA d'identité dédiée à ce holder (indépendante de celle du premier porteur,
  // une IdentityProxy n'a besoin que de pointer vers UNE implémentation Identity valide).
  const identityImpl = await deploy(loadArtifact("Identity.sol/Identity.json"), [deployer.address, true]);
  const identityIA = await deploy(loadArtifact("proxy/ImplementationAuthority.sol/ImplementationAuthority.json"), [
    await identityImpl.getAddress(),
  ]);

  const secondHolder = ethers.Wallet.createRandom();
  const secondIdentity = await deploy(loadArtifact("proxy/IdentityProxy.sol/IdentityProxy.json"), [
    await identityIA.getAddress(),
    secondHolder.address,
  ]);
  await (await (identityRegistry as any).registerIdentity(secondHolder.address, await secondIdentity.getAddress(), 840)).wait();
  console.log("Deuxième porteur enregistré :", secondHolder.address);

  const transferAmount = ethers.parseUnits("100", 18);
  await (await (token as any).transfer(secondHolder.address, transferAmount)).wait();
  console.log("100 RPD transférés au deuxième porteur");

  await (await (token as any).freezePartialTokens(secondHolder.address, ethers.parseUnits("20", 18))).wait();
  console.log("20 RPD gelés partiellement sur le deuxième porteur");

  const summary = {
    network: "sepolia",
    tokenAddress: TOKEN_ADDRESS,
    identityRegistryAddress: IR_ADDRESS,
    startBlock: START_BLOCK,
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
