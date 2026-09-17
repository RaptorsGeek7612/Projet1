export const REGISTRY_API_URL = process.env.NEXT_PUBLIC_REGISTRY_API_URL ?? "http://localhost:42069";

export type Holder = {
  address: string;
  balance: string;
  frozenBalance: string;
  transferable: string;
  isFrozen: boolean;
  identity: string | null;
  country: number | null;
  countryName: string | null;
  firstSeenAt: number | null;
  lastActivityAt: number | null;
  transferCount: number;
};

export type TokenStats = {
  token: string;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupply: string;
  holderCount: number;
  frozenHolderCount: number;
  isPaused: boolean;
  lastIndexedBlock: number | null;
};

export async function fetchRegistry(): Promise<{ holders: Holder[]; count: number }> {
  const res = await fetch(`${REGISTRY_API_URL}/registry`);
  if (!res.ok) throw new Error(`registry fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchStats(): Promise<TokenStats> {
  const res = await fetch(`${REGISTRY_API_URL}/stats`);
  if (!res.ok) throw new Error(`stats fetch failed: ${res.status}`);
  return res.json();
}

/** Formate un uint256 en chaîne (18 décimales) vers une valeur lisible, 4 décimales max. */
export function formatTokenAmount(raw: string, decimals = 18): string {
  const value = BigInt(raw);
  const base = BigInt(10) ** BigInt(decimals);
  const whole = value / base;
  const fraction = value % base;
  if (fraction === BigInt(0)) return whole.toString();
  const fractionStr = fraction.toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");
  return fractionStr ? `${whole}.${fractionStr}` : whole.toString();
}
