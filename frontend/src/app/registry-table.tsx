"use client";

import { useState, type ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Flags from "country-flag-icons/react/3x2";
import { fetchRegistry, fetchStats, formatTokenAmount, type Holder, REGISTRY_API_URL } from "@/lib/registry";
import { countryAlpha2 } from "@/lib/countries";

function CountryBadge({ country, countryName }: { country: number | null; countryName: string | null }) {
  const alpha2 = countryAlpha2(country);
  const FlagIcon = alpha2 ? (Flags as Record<string, ComponentType<{ className?: string }>>)[alpha2] : undefined;

  if (!FlagIcon || !countryName) {
    return (
      <span className="text-xs" style={{ color: "var(--status-warning)" }}>
        Pays inconnu
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
      <FlagIcon className="h-3 w-4.5 rounded-[2px] shadow-[0_0_0_1px_var(--border)]" />
      {countryName}
    </span>
  );
}

function CopyableAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <span className="inline-flex items-center gap-1.5">
      <a
        href={`https://sepolia.etherscan.io/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs tabular hover:underline"
        style={{ color: "var(--text-primary)" }}
        title="Ouvrir sur Etherscan (Sepolia)"
      >
        {address.slice(0, 6)}…{address.slice(-4)}
      </a>
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
        className="text-xs transition-colors"
        style={{ color: copied ? "var(--status-good)" : "var(--text-muted)" }}
        title="Copier l'adresse"
      >
        {copied ? "✓" : "⧉"}
      </button>
    </span>
  );
}

function Amount({ value, symbol, color }: { value: string; symbol: string; color?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="font-display tabular text-[0.95rem] font-semibold" style={{ color: color ?? "var(--text-primary)" }}>
        {value}
      </span>
      <span className="text-[0.65rem] font-medium tracking-wide" style={{ color: "var(--text-muted)" }}>
        {symbol}
      </span>
    </span>
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
        <CountryBadge country={holder.country} countryName={holder.countryName} />
      </td>
      <td className="py-3 pr-4">
        <Amount value={formatTokenAmount(holder.balance, decimals)} symbol={symbol} />
      </td>
      <td className="py-3 pr-4">
        {frozen ? (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
            style={{ background: "var(--accent-soft)" }}
            title="Solde gelé partiellement par un agent (freezePartialTokens) : bloqué au transfert, mais toujours comptabilisé dans le solde total."
          >
            <Amount value={formatTokenAmount(holder.frozenBalance, decimals)} symbol={symbol} color="var(--status-warning)" />
          </span>
        ) : (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            —
          </span>
        )}
      </td>
      <td className="py-3">
        <Amount value={formatTokenAmount(holder.transferable, decimals)} symbol={symbol} color="var(--accent-2)" />
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
        Impossible de joindre l&apos;indexeur ({REGISTRY_API_URL}). Vérifiez qu&apos;il tourne bien.
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
