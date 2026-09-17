import { ethers } from "ethers";

/**
 * Déploiement de la suite T-REX, factorisé entre scripts/deploy.ts (Sepolia)
 * et test/contracts (réseau local Hardhat) : même séquence, seul le signer
 * et la façon de charger les artefacts changent.
 */

export type Artifact = { abi: ethers.InterfaceAbi; bytecode: string };
export type LoadArtifact = (relPath: string) => Artifact;

export type DeployedSuite = {
  token: ethers.Contract;
  identityRegistry: ethers.Contract;
  tokenAddress: string;
  identityRegistryAddress: string;
  /** Implementation authority ONCHAINID : nécessaire pour déployer d'autres IdentityProxy (nouveaux porteurs). */
  identityImplementationAuthorityAddress: string;
  deployBlock: number;
};

export async function deployTrexSuite(
  deployer: ethers.Signer,
  loadArtifact: LoadArtifact,
  tokenParams: { name: string; symbol: string; decimals: number } = {
    name: "Registre Porteurs Demo",
    symbol: "RPD",
    decimals: 18,
  }
): Promise<DeployedSuite> {
  const deployerAddress = await deployer.getAddress();

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

  // 2. Infrastructure ONCHAINID (identités des porteurs)
  const identityImpl = await deploy(loadArtifact("Identity.sol/Identity.json"), [deployerAddress, true]);
  const identityIA = await deploy(loadArtifact("proxy/ImplementationAuthority.sol/ImplementationAuthority.json"), [
    await identityImpl.getAddress(),
  ]);
  const idFactory = await deploy(loadArtifact("factory/IdFactory.sol/IdFactory.json"), [await identityIA.getAddress()]);

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

  // 4. Factory : déploie la suite complète (registres + compliance + token) en un seul appel
  const trexFactory = await deploy(loadArtifact("factory/TREXFactory.sol/TREXFactory.json"), [
    await trexIA.getAddress(),
    await idFactory.getAddress(),
  ]);
  await (await (idFactory as any).addTokenFactory(await trexFactory.getAddress())).wait();

  const salt = `suite-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const tokenDetails = {
    owner: deployerAddress,
    name: tokenParams.name,
    symbol: tokenParams.symbol,
    decimals: tokenParams.decimals,
    irs: ethers.ZeroAddress,
    ONCHAINID: ethers.ZeroAddress,
    irAgents: [deployerAddress],
    tokenAgents: [deployerAddress],
    complianceModules: [],
    complianceSettings: [],
  };
  // Aucun claim topic requis : isVerified() ne vérifie alors que l'enregistrement
  // de l'identité, pas de claim issuer signée à mettre en place.
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

  const token = new ethers.Contract(tokenAddress, loadArtifact("token/Token.sol/Token.json").abi, deployer);
  const identityRegistry = new ethers.Contract(
    irAddress,
    loadArtifact("registry/implementation/IdentityRegistry.sol/IdentityRegistry.json").abi,
    deployer
  );

  return {
    token,
    identityRegistry,
    tokenAddress,
    identityRegistryAddress: irAddress,
    identityImplementationAuthorityAddress: await identityIA.getAddress(),
    deployBlock: receipt.blockNumber,
  };
}

/** Déploie une IdentityProxy ONCHAINID pour un porteur donné. */
export async function deployIdentityFor(
  deployer: ethers.Signer,
  loadArtifact: LoadArtifact,
  identityImplementationAuthorityAddress: string,
  holderAddress: string
): Promise<ethers.Contract> {
  const artifact = loadArtifact("proxy/IdentityProxy.sol/IdentityProxy.json");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
  const identity = await factory.deploy(identityImplementationAuthorityAddress, holderAddress);
  await identity.waitForDeployment();
  return identity as unknown as ethers.Contract;
}
