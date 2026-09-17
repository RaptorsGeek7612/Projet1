"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletChip() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  // wagmi restaure la connexion précédente depuis le stockage local, ce qui
  // diffère forcément du rendu serveur (jamais connecté) : sans ce garde-fou,
  // React lève un mismatch d'hydratation sur ce bloc.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-9 w-32 rounded-full" style={{ background: "var(--surface-2)" }} />;
  }

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className="group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
        style={{
          borderColor: "var(--border)",
          background: "linear-gradient(160deg, var(--surface) 0%, var(--surface-tint) 100%)",
          color: "var(--text-primary)",
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full pulse-dot"
          style={{ background: "var(--status-good)" }}
        />
        <span className="font-mono tabular">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <span className="text-[var(--text-muted)] group-hover:text-[var(--status-critical)]">Déconnecter</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
          className="rounded-full px-4 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)" }}
        >
          Connecter {connector.name}
        </button>
      ))}
    </div>
  );
}
