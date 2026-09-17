"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchStats } from "@/lib/registry";
import { LogoMark } from "@/components/logo";
import { WalletChip } from "@/components/wallet-chip";
import { StatTiles } from "@/components/stat-tiles";
import { NetworkBackground } from "@/components/network-background";
import { RegistryTable } from "./registry-table";

function NetworkBadge() {
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
    refetchInterval: 5000,
  });

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
      style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
    >
      <span className="h-1.5 w-1.5 rounded-full pulse-dot" style={{ background: "var(--status-good)" }} />
      Sepolia
      {stats?.lastIndexedBlock != null && (
        <span className="tabular" style={{ color: "var(--text-muted)" }}>
          · bloc {stats.lastIndexedBlock.toLocaleString("fr-FR")}
        </span>
      )}
    </span>
  );
}

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col" style={{ background: "var(--bg)" }}>
      <div className="institutional-bg pointer-events-none fixed inset-0 -z-10">
        <NetworkBackground />
      </div>

      <header
        className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-5 sm:px-10"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-4">
          <LogoMark className="h-14 w-14 drop-shadow-[0_0_14px_var(--accent-soft)]" />
          <div>
            <h1 className="font-display text-lg font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Registre des Porteurs
            </h1>
            <p className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Conformité ERC-3643
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NetworkBadge />
          <WalletChip />
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-6 py-10 sm:px-10">
        <div className="flex flex-col gap-3">
          <h2
            className="font-display text-3xl italic tracking-tight sm:text-4xl"
            style={{ color: "var(--text-primary)" }}
          >
            Qui détient quoi. À l&apos;instant, sans exception.
          </h2>
          <p className="max-w-2xl text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Chaque position. Chaque restriction de transfert. Chaque identité déclarée. Ancrées
            directement sur la chaîne, consolidées en continu : une source unique de vérité, à la
            hauteur des plus grandes institutions.
          </p>
        </div>

        <StatTiles />

        <section className="glow-card flex flex-col gap-4 rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Porteurs
            </h3>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Rafraîchi toutes les 5s
            </span>
          </div>
          <RegistryTable />
        </section>
      </main>

      <footer
        className="border-t px-6 py-4 text-center text-xs sm:px-10"
        style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
      >
        Registre reconstitué depuis la chaîne. Aucune donnée interpolée, aucune donnée estimée.
      </footer>
    </div>
  );
}
