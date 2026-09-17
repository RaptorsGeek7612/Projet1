import "dotenv/config";
import { ethers } from "ethers";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Ajoute une vraie exigence de claim KYC à la suite T-REX déjà déployée sur
 * Sepolia (TOKEN_ADDRESS / IDENTITY_REGISTRY_ADDRESS ci-dessous), sans la
 * redéployer : jusqu'ici isVerified() était toujours vrai (aucun claim topic
 * requis), ce qui ne représente pas un vrai déploiement de conformité.
 *
 * Effet de bord assumé : le porteur "second holder" du déploiement initial
 * (wallet jetable dont la clé privée n'a jamais été conservée) ne pourra
 * plus RECEVOIR de nouveaux tokens une fois le claim topic actif — Token.
 * transfer()/mint() ne vérifient que le DESTINATAIRE, pas l'émetteur, donc
 * son solde existant et sa capacité à envoyer restent intacts. Documenté
 * dans le README plutôt que masqué.
 */

type Artifact = { abi: ethers.InterfaceAbi; bytecode: string };

function loadArtifact(relPath: string): Artifact {
  const json = JSON.parse(readFileSync(join(__dirname, "../artifacts/src/contracts", relPath), "utf-8"));
  return { abi: json.abi, bytecode: json.bytecode };
}

const TOKEN_ADDRESS = "0x2C75bB41c4B90Da410D39D7413304922Ddb497D9";
const IDENTITY_REGISTRY_ADDRESS = "0xafe7308c10F26C6cC5e0d83938dc10D421704c23";

// Topic KYC arbitraire mais stable (uint256 dérivé d'un hash, comme le fait
// la fixture officielle T-REX pour ses topics de test).
const KYC_TOPIC = BigInt(ethers.id("KYC_APPROVED"));
const CLAIM_SCHEME = 1; // ECDSA, seul schéma géré par isClaimValid() ici.
const PURPOSE_CLAIM = 3;
const KEY_TYPE_ECDSA = 1;

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!rpcUrl || !privateKey) {
    throw new Error("SEPOLIA_RPC_URL et DEPLOYER_PRIVATE_KEY doivent être définis dans backend/.env");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const deployer = new ethers.Wallet(privateKey, provider);
  console.log("Depuis", deployer.address);

  const identityRegistry = new ethers.Contract(
    IDENTITY_REGISTRY_ADDRESS,
    loadArtifact("registry/implementation/IdentityRegistry.sol/IdentityRegistry.json").abi,
    deployer
  );

  const ctrAddress = await (identityRegistry as any).topicsRegistry();
  const tirAddress = await (identityRegistry as any).issuersRegistry();
  console.log("ClaimTopicsRegistry:", ctrAddress);
  console.log("TrustedIssuersRegistry:", tirAddress);

  const claimTopicsRegistry = new ethers.Contract(
    ctrAddress,
    loadArtifact("registry/implementation/ClaimTopicsRegistry.sol/ClaimTopicsRegistry.json").abi,
    deployer
  );
  const trustedIssuersRegistry = new ethers.Contract(
    tirAddress,
    loadArtifact("registry/implementation/TrustedIssuersRegistry.sol/TrustedIssuersRegistry.json").abi,
    deployer
  );

  // 1. Exiger le claim KYC pour toute nouvelle vérification.
  await (await (claimTopicsRegistry as any).addClaimTopic(KYC_TOPIC)).wait();
  console.log("Claim topic KYC_APPROVED enregistré :", KYC_TOPIC.toString());

  // 2. Déployer l'émetteur de claims (ClaimIssuer), avec une clé de signature dédiée.
  const claimIssuerArtifact = loadArtifact("ClaimIssuer.sol/ClaimIssuer.json");
  const claimIssuerFactory = new ethers.ContractFactory(claimIssuerArtifact.abi, claimIssuerArtifact.bytecode, deployer);
  const claimIssuer = await claimIssuerFactory.deploy(deployer.address);
  await claimIssuer.waitForDeployment();
  console.log("ClaimIssuer déployé :", await claimIssuer.getAddress());

  const signingKey = ethers.Wallet.createRandom();
  await (
    await (claimIssuer as any).addKey(
      ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address"], [signingKey.address])),
      PURPOSE_CLAIM,
      KEY_TYPE_ECDSA
    )
  ).wait();
  console.log("Clé de signature des claims ajoutée à l'émetteur");

  // 3. Faire confiance à cet émetteur pour le topic KYC.
  await (await (trustedIssuersRegistry as any).addTrustedIssuer(await claimIssuer.getAddress(), [KYC_TOPIC])).wait();
  console.log("Émetteur de claims déclaré de confiance pour KYC_APPROVED");

  // 4. Émettre et attacher un claim signé au porteur qu'on contrôle encore
  // (le déployeur — le second porteur du déploiement initial a une clé perdue).
  const holderIdentityAddress = await (identityRegistry as any).identity(deployer.address);
  const holderIdentity = new ethers.Contract(holderIdentityAddress, loadArtifact("Identity.sol/Identity.json").abi, deployer);

  // addClaim() exige une clé CLAIM (purpose 3) sur l'identité elle-même,
  // pas seulement la clé MANAGEMENT (purpose 1) déjà présente.
  await (
    await (holderIdentity as any).addKey(
      ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["address"], [deployer.address])),
      PURPOSE_CLAIM,
      KEY_TYPE_ECDSA
    )
  ).wait();

  const claimData = ethers.toUtf8Bytes("KYC verifie - registre de porteurs demo");
  const dataHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256", "bytes"], [holderIdentityAddress, KYC_TOPIC, claimData])
  );
  const signature = await signingKey.signMessage(ethers.getBytes(dataHash));

  await (
    await (holderIdentity as any).addClaim(KYC_TOPIC, CLAIM_SCHEME, await claimIssuer.getAddress(), signature, claimData, "")
  ).wait();
  console.log("Claim KYC attaché à l'identité du déployeur");

  // Vérification : isVerified() dépend maintenant réellement du claim.
  const token = new ethers.Contract(TOKEN_ADDRESS, loadArtifact("token/Token.sol/Token.json").abi, deployer);
  const secondHolderAddress = "0xdBC656A8CaBA1b28B3247b9AeE9cb7d9ebDbA4Fb";

  console.log("isVerified(déployeur) =", await (identityRegistry as any).isVerified(deployer.address), "(attendu: true)");
  console.log("isVerified(second porteur, sans claim) =", await (identityRegistry as any).isVerified(secondHolderAddress), "(attendu: false)");

  console.log("\nClaimIssuer :", await claimIssuer.getAddress());
  console.log("Claim topic KYC_APPROVED :", KYC_TOPIC.toString());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
