"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchRegistry, fetchStats, formatTokenAmount } from "@/lib/registry";

function Tile({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: "good" | "warning" | "neutral";
}) {
  const dot =
    accent === "good" ? "var(--status-good)" : accent === "warning" ? "var(--status-warning)" : "var(--accent)";

  return (
    <div className="glow-card flex flex-1 flex-col gap-2 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display tabular text-2xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
          {value}
        </span>
        {unit && (
          <span className="text-[0.7rem] font-medium tracking-wide" style={{ color: "var(--text-muted)" }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export function StatTiles() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    refetchInterval: 5000,
  });
  // Même clé/fonction que RegistryTable : React Query partage le cache,
  // ce n'est pas une requête HTTP supplémentaire.
  const { data: registry, isLoading: registryLoading } = useQuery({
    queryKey: ["registry"],
    queryFn: fetchRegistry,
    refetchInterval: 5000,
  });

  if (statsLoading || registryLoading || !stats) {
    return (
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[76px] flex-1 animate-pulse rounded-2xl border"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          />
        ))}
      </div>
    );
  }

  // stats.frozenHolderCount ne compte que les adresses ENTIÈREMENT gelées
  // (AddressFrozen) — pas les gels partiels (freezePartialTokens). Le compte
  // affiché ici vient donc du registre, pas de cet agrégat.
  const partialFreezeCount = (registry?.holders ?? []).filter((h) => h.frozenBalance !== "0").length;

  return (
    <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile label="Encours total" value={formatTokenAmount(stats.totalSupply, stats.decimals ?? 18)} unit={stats.symbol ?? ""} />
      <Tile label="Porteurs" value={String(stats.holderCount)} accent="good" />
      <Tile label="Gels partiels" value={String(partialFreezeCount)} accent={partialFreezeCount > 0 ? "warning" : "neutral"} />
      <Tile
        label="Statut du token"
        value={stats.isPaused ? "En pause" : "Actif"}
        accent={stats.isPaused ? "warning" : "good"}
      />
    </div>
  );
}
