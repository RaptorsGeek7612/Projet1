/**
 * ERC-3643 stocke le pays sur un uint16 : le code numerique ISO 3166-1.
 * Pas le code alpha-2. C'est une source de confusion frequente quand on
 * configure un module de restriction par pays.
 *
 * Table partielle, orientee UE. Complete-la selon les juridictions
 * reellement presentes dans ton registre.
 */
const ISO: Record<number, string> = {
  36: "Australie", 40: "Autriche", 56: "Belgique", 124: "Canada",
  156: "Chine", 191: "Croatie", 196: "Chypre", 203: "Tchequie",
  208: "Danemark", 233: "Estonie", 246: "Finlande", 250: "France",
  276: "Allemagne", 300: "Grece", 344: "Hong Kong", 348: "Hongrie",
  372: "Irlande", 376: "Israel", 380: "Italie", 392: "Japon",
  428: "Lettonie", 440: "Lituanie", 442: "Luxembourg", 470: "Malte",
  528: "Pays-Bas", 578: "Norvege", 616: "Pologne", 620: "Portugal",
  642: "Roumanie", 702: "Singapour", 703: "Slovaquie", 705: "Slovenie",
  724: "Espagne", 752: "Suede", 756: "Suisse",
  784: "Emirats arabes unis", 826: "Royaume-Uni", 840: "Etats-Unis",
};

export function countryName(code: number): string {
  return ISO[code] ?? `ISO-${code}`;
}
