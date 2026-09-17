"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchRegistry, fetchStats, formatTokenAmount, type Holder, REGISTRY_API_URL } from "@/lib/registry";

const COUNTRY_COLORS = ["var(--cat-1)", "var(--cat-2)", "var(--cat-3)"];

function countryColor(country: number | null) {
  if (country == null) return "var(--text-muted)";
  return COUNTRY_COLORS[country % COUNTRY_COLORS.length];
}

function CopyableAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          // clipboard indisponible (contexte non sécurisé, permission refusée) : pas bloquant
        }
      }}
      className="group inline-flex items-center gap-1.5 font-mono text-xs tabular"
      style={{ color: "var(--text-primary)" }}
      title={address}
    >
      {address.slice(0, 6)}…{address.slice(-4)}
      <span
        className="opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: copied ? "var(--status-good)" : "var(--text-muted)" }}
      >
        {copied ? "✓" : "⧉"}
      </span>
    </button>
  );
}

function Row({ holder, decimals, symbol }: { holder: Holder; decimals: number; symbol: string }) {
  const frozen = holder.frozenBalance !== "0";
  return (
    <tr className="border-b transition-colors hover:bg-[var(--surface-2)]" style={{ borderColor: "var(--border)" }}>
      <td className="py-3 pr-4">
        <CopyableAddress address={holder.address} />
      </td>
      <td className="py-3 pr-4">
        {holder.countryName ? (
          <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: countryColor(holder.country) }} />
            {holder.countryName}
          </span>
        ) : (
          <span className="text-xs" style={{ color: "var(--status-warning)" }}>
            Pays inconnu
          </span>
        )}
      </td>
      <td className="py-3 pr-4 tabular text-sm" style={{ color: "var(--text-primary)" }}>
        {formatTokenAmount(holder.balance, decimals)} {symbol}
      </td>
      <td className="py-3 pr-4">
        {frozen ? (
          <span
            className="tabular inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: "var(--accent-soft)", color: "var(--status-warning)" }}
          >
            {formatTokenAmount(holder.frozenBalance, decimals)} {symbol}
          </span>
        ) : (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            —
          </span>
        )}
      </td>
      <td className="py-3 tabular text-sm font-medium" style={{ color: "var(--accent-2)" }}>
        {formatTokenAmount(holder.transferable, decimals)} {symbol}
      </td>
    </tr>
  );
}

export function RegistryTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["registry"],
    queryFn: fetchRegistry,
    refetchInterval: 5000,
  });
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    refetchInterval: 5000,
  });
  const decimals = stats?.decimals ?? 18;
  const symbol = stats?.symbol ?? "";

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg" style={{ background: "var(--surface-2)" }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm" style={{ color: "var(--status-critical)" }}>
        Impossible de joindre l&apos;indexeur ({REGISTRY_API_URL}). Vérifiez que le backend tourne (
        <code>pnpm dev</code> dans <code>backend/</code>).
      </p>
    );
  }

  const holders = data?.holders ?? [];

  if (holders.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        Aucun porteur indexé pour l&apos;instant.
      </p>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            <th className="py-2 pr-4 font-medium">Porteur</th>
            <th className="py-2 pr-4 font-medium">Juridiction</th>
            <th className="py-2 pr-4 font-medium">Solde</th>
            <th className="py-2 pr-4 font-medium">Gelé</th>
            <th className="py-2 font-medium">Transférable</th>
          </tr>
        </thead>
        <tbody>
          {holders.map((h) => (
            <Row key={h.address} holder={h} decimals={decimals} symbol={symbol} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
