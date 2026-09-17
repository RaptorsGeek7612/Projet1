/**
 * ERC-3643 stocke le pays en uint16 ISO 3166-1 numérique (voir backend/src/countries.ts,
 * même table). Ce module n'ajoute que la conversion vers le code alpha-2 correspondant,
 * utilisé pour choisir le composant drapeau (country-flag-icons) à afficher.
 */
export const ISO_NUMERIC_TO_ALPHA2: Record<number, string> = {
  36: "AU", 40: "AT", 56: "BE", 124: "CA",
  156: "CN", 191: "HR", 196: "CY", 203: "CZ",
  208: "DK", 233: "EE", 246: "FI", 250: "FR",
  276: "DE", 300: "GR", 344: "HK", 348: "HU",
  372: "IE", 376: "IL", 380: "IT", 392: "JP",
  428: "LV", 440: "LT", 442: "LU", 470: "MT",
  528: "NL", 578: "NO", 616: "PL", 620: "PT",
  642: "RO", 702: "SG", 703: "SK", 705: "SI",
  724: "ES", 752: "SE", 756: "CH",
  784: "AE", 826: "GB", 840: "US",
};

export function countryAlpha2(code: number | null): string | null {
  if (code == null) return null;
  return ISO_NUMERIC_TO_ALPHA2[code] ?? null;
}
