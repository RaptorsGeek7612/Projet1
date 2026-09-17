import "dotenv/config";
import { ethers } from "ethers";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Déploie une suite T-REX minimale sur Sepolia : registres + token, sans
 * module de conformité ni claim topic. isVerified() ne vérifie alors que
 * l'enregistrement de l'identité, ce qui suffit à obtenir un token réel et
 * indexable sans monter d'infrastructure de claim issuers.
 */

type Artifact = { abi: ethers.InterfaceAbi; bytecode: string };

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

  async function deploy(artifact: Artifact, args: unknown[] = []) {
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
    const contract = await factory.deploy(...args);
    await contract.waitForDeployment();
    return contract;
  }

  // 1. Implémentations T-REX (contrats de logique, sans état, utilisés via proxy)
  const ctrImpl = await deploy(loadArtifact("registry/implementation/ClaimTopicsRegistry.sol/ClaimTopicsRegistry.json"));
  const tirImpl = await deploy(loadArtifact("registry/implementation/TrustedIssuersRegistry.sol/TrustedIssuersRegistry.json"));
  const irsImpl = await deploy(loadArtifact("registry/implementation/IdentityRegistryStorage.sol/IdentityRegistryStorage.json"));
  const irImpl = await deploy(loadArtifact("registry/implementation/IdentityRegistry.sol/IdentityRegistry.json"));
  const mcImpl = await deploy(loadArtifact("compliance/modular/ModularCompliance.sol/ModularCompliance.json"));
  const tokenImpl = await deploy(loadArtifact("token/Token.sol/Token.json"));
  console.log("Implémentations T-REX déployées");

  // 2. Infrastructure ONCHAINID (identités des porteurs)
  const identityImpl = await deploy(loadArtifact("Identity.sol/Identity.json"), [deployer.address, true]);
  const identityIA = await deploy(loadArtifact("proxy/ImplementationAuthority.sol/ImplementationAuthority.json"), [
    await identityImpl.getAddress(),
  ]);
  const idFactory = await deploy(loadArtifact("factory/IdFactory.sol/IdFactory.json"), [await identityIA.getAddress()]);
  console.log("Infrastructure ONCHAINID déployée");

  // 3. Implementation authority T-REX : référence les six implémentations ci-dessus
  const trexIA = await deploy(
    loadArtifact("proxy/authority/TREXImplementationAuthority.sol/TREXImplementationAuthority.json"),
    [true, ethers.ZeroAddress, ethers.ZeroAddress]
  );
  const versionStruct = { major: 4, minor: 1, patch: 6 };
  const contractsStruct = {
    tokenImplementation: await tokenImpl.getAddress(),
    ctrImplementation: await ctrImpl.getAddress(),
    irImplementation: await irImpl.getAddress(),
    irsImplementation: await irsImpl.getAddress(),
    tirImplementation: await tirImpl.getAddress(),
    mcImplementation: await mcImpl.getAddress(),
  };
  await (await (trexIA as any).addAndUseTREXVersion(versionStruct, contractsStruct)).wait();
  console.log("Implementation authority configurée");

  // 4. Factory : déploie la suite complète (registres + compliance + token) en un seul appel
  const trexFactory = await deploy(loadArtifact("factory/TREXFactory.sol/TREXFactory.json"), [
    await trexIA.getAddress(),
    await idFactory.getAddress(),
  ]);
  await (await (idFactory as any).addTokenFactory(await trexFactory.getAddress())).wait();
  console.log("TREXFactory prêt :", await trexFactory.getAddress());

  const salt = `registre-porteurs-${Date.now()}`;
  const tokenDetails = {
    owner: deployer.address,
    name: "Registre Porteurs Demo",
    symbol: "RPD",
    decimals: 18,
    irs: ethers.ZeroAddress,
    ONCHAINID: ethers.ZeroAddress,
    irAgents: [deployer.address],
    tokenAgents: [deployer.address],
    complianceModules: [],
    complianceSettings: [],
  };
  // Aucun claim topic requis : isVerified() ne vérifie alors que l'enregistrement
  // de l'identité, pas de claim issuer signée à mettre en place pour ce test.
  const claimDetails = { claimTopics: [], issuers: [], issuerClaims: [] };

  const deployTx = await (trexFactory as any).deployTREXSuite(salt, tokenDetails, claimDetails);
  const receipt = await deployTx.wait();
  if (!receipt) throw new Error("pas de reçu pour deployTREXSuite");

  const iface = new ethers.Interface(loadArtifact("factory/ITREXFactory.sol/ITREXFactory.json").abi);
  let tokenAddress = "";
  let irAddress = "";
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "TREXSuiteDeployed") {
        tokenAddress = parsed.args._token as string;
        irAddress = parsed.args._ir as string;
      }
    } catch {
      // log d'un autre contrat (implémentations, proxys) : pas notre événement
    }
  }
  if (!tokenAddress || !irAddress) throw new Error("TREXSuiteDeployed introuvable dans les logs de déploiement");

  console.log("Token:", tokenAddress);
  console.log("IdentityRegistry:", irAddress);
  console.log("Bloc de déploiement:", receipt.blockNumber);

  const token = new ethers.Contract(tokenAddress, loadArtifact("token/Token.sol/Token.json").abi, deployer);
  const identityRegistry = new ethers.Contract(
    irAddress,
    loadArtifact("registry/implementation/IdentityRegistry.sol/IdentityRegistry.json").abi,
    deployer
  );

  // 5. Porteur n°1 : le déployeur lui-même, pour pouvoir minter un solde de départ
  const deployerIdentity = await deploy(loadArtifact("proxy/IdentityProxy.sol/IdentityProxy.json"), [
    await identityIA.getAddress(),
    deployer.address,
  ]);
  await (await (identityRegistry as any).registerIdentity(deployer.address, await deployerIdentity.getAddress(), 250)).wait();

  const mintAmount = ethers.parseUnits("1000", 18);
  await (await (token as any).mint(deployer.address, mintAmount)).wait();
  console.log("1000 RPD mintés vers", deployer.address);

  // Le token T-REX démarre en pause : mint() passe, mais transfer() est bloqué tant
  // qu'un agent n'a pas explicitement dépausé.
  await (await (token as any).unpause()).wait();
  console.log("Token dépausé");

  // 6. Porteur n°2 : wallet aléatoire jetable (recevoir ne coûte pas de gas, pas besoin de le financer)
  const secondHolder = ethers.Wallet.createRandom();
  const secondIdentity = await deploy(loadArtifact("proxy/IdentityProxy.sol/IdentityProxy.json"), [
    await identityIA.getAddress(),
    secondHolder.address,
  ]);
  await (await (identityRegistry as any).registerIdentity(secondHolder.address, await secondIdentity.getAddress(), 840)).wait();

  const transferAmount = ethers.parseUnits("100", 18);
  await (await (token as any).transfer(secondHolder.address, transferAmount)).wait();

  // Gel partiel pour exercer /registry/anomalies et l'audit des actions d'agent côté indexeur
  await (await (token as any).freezePartialTokens(secondHolder.address, ethers.parseUnits("20", 18))).wait();
  console.log("Deuxième porteur (jetable, clé privée non conservée) :", secondHolder.address);

  const summary = {
    network: "sepolia",
    tokenAddress,
    identityRegistryAddress: irAddress,
    startBlock: receipt.blockNumber,
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
