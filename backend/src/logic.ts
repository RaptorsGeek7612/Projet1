import { decodeFunctionData } from "viem";
import { IdentityRegistryAbi } from "../abis/trex";

/**
 * Logique pure de l'indexeur, sans dépendance à Ponder (pas de `ponder:registry`
 * ni `ponder:schema`, importables uniquement dans son runtime). Séparée du
 * fichier des handlers pour rester testable avec vitest en dehors de Ponder.
 * C'est précisément cette logique — transitions de seuil, décodage de calldata —
 * qui a produit les bugs trouvés en testant contre le vrai déploiement.
 */

export function eventId(ev: { transaction: { hash: string }; log: { logIndex: number } }) {
  return `${ev.transaction.hash}-${ev.log.logIndex}`;
}

/**
 * Décode le calldata d'un appel à registerIdentity() ou batchRegisterIdentity()
 * pour en extraire le pays de `investorAddress`, faute d'événement qui le porte.
 * Retourne null si le calldata ne correspond à aucune des deux signatures
 * (ex. appel via un contrat intermédiaire dont on ne peut pas décoder l'entrée).
 */
export function decodeRegisteredCountry(input: `0x${string}`, investorAddress: `0x${string}`): number | null {
  try {
    const decoded = decodeFunctionData({ abi: IdentityRegistryAbi, data: input });
    if (decoded.functionName === "registerIdentity") {
      const [, , country] = decoded.args;
      return Number(country);
    }
    if (decoded.functionName === "batchRegisterIdentity") {
      const [addresses, , countries] = decoded.args;
      const index = addresses.findIndex((a) => a.toLowerCase() === investorAddress.toLowerCase());
      return index === -1 ? null : Number(countries[index]);
    }
  } catch {
    // calldata d'un appel qu'on ne sait pas décoder (ex. via un contrat intermédiaire)
  }
  return null;
}

export type BalanceTransition = {
  next: bigint;
  becameHolder: boolean;
  leftRegister: boolean;
};

/** Un porteur naît quand son solde passe de 0 à non nul, et disparaît à l'inverse. */
export function classifyBalanceTransition(previous: bigint, delta: bigint): BalanceTransition {
  const next = previous + delta;
  return {
    next,
    becameHolder: previous === 0n && next > 0n,
    leftRegister: previous > 0n && next === 0n,
  };
}

/**
 * Le contrat émet AddressFrozen même sans changement d'état réel (un agent qui
 * regèle une adresse déjà gelée). Sans ce garde-fou, frozenHolderCount dérive
 * à chaque appel redondant au lieu de suivre une vraie transition.
 */
export function classifyFreezeTransition(wasFrozen: boolean, isFrozen: boolean): { changed: boolean; step: 1 | -1 | 0 } {
  if (wasFrozen === isFrozen) return { changed: false, step: 0 };
  return { changed: true, step: isFrozen ? 1 : -1 };
}

export type CountryMove = {
  /** Pays à décrémenter dans countryStat (le porteur le quitte), ou null si rien à faire. */
  from: { country: number; balance: bigint } | null;
  /** Pays à incrémenter dans countryStat (le porteur y entre), ou null si rien à faire. */
  to: { country: number; balance: bigint } | null;
};

/**
 * Calcule le déplacement d'un porteur d'un pays à l'autre dans les agrégats
 * countryStat, à partir de son état précédent et du nouveau pays affecté.
 * N'a d'effet que si le porteur a un solde non nul (countryStat ne compte que
 * l'encours réel, pas les porteurs enregistrés sans jamais avoir de solde).
 */
export function computeCountryMove(
  before: { country: number | null; balance: bigint } | null | undefined,
  newCountry: number
): CountryMove {
  if (!before || before.balance <= 0n || before.country === newCountry) {
    return { from: null, to: null };
  }
  return {
    from: before.country != null ? { country: before.country, balance: before.balance } : null,
    to: { country: newCountry, balance: before.balance },
  };
}
