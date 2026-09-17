"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchStats } from "@/lib/registry";
import { LogoMark } from "@/components/logo";
import { WalletChip } from "@/components/wallet-chip";
import { StatTiles } from "@/components/stat-tiles";
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
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60rem 40rem at 15% -10%, var(--glow-1), transparent 60%), radial-gradient(50rem 35rem at 110% 10%, var(--glow-2), transparent 60%)",
        }}
      />

      <header
        className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-5 sm:px-10"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <LogoMark className="h-8 w-8" />
          <div>
            <h1 className="text-sm font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Registre des porteurs
            </h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Conformité ERC-3643 · T-REX
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NetworkBadge />
          <WalletChip />
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-6 py-10 sm:px-10">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl" style={{ color: "var(--text-primary)" }}>
            Qui détient quoi, en temps réel.
          </h2>
          <p className="max-w-2xl text-sm" style={{ color: "var(--text-secondary)" }}>
            Reconstruit depuis la chaîne par l&apos;indexeur Ponder du dossier{" "}
            <code className="rounded px-1 py-0.5 font-mono text-xs" style={{ background: "var(--surface-2)" }}>
              backend
            </code>{" "}
            — soldes, gels et identités, sans jamais lire l&apos;état on-chain à la demande.
          </p>
        </div>

        <StatTiles />

        <section
          className="flex flex-col gap-4 rounded-2xl border p-5 sm:p-6"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
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
        Données dérivées des événements on-chain — jamais lues on-chain à la demande.
      </footer>
    </div>
  );
}
