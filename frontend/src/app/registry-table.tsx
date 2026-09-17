"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchRegistry, formatTokenAmount, REGISTRY_API_URL } from "@/lib/registry";

export function RegistryTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["registry"],
    queryFn: fetchRegistry,
    refetchInterval: 5000,
  });

  if (isLoading) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Chargement du registre…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Impossible de joindre l&apos;indexeur ({REGISTRY_API_URL}). Vérifiez que le backend tourne (
        <code>pnpm dev</code> dans <code>backend/</code>).
      </p>
    );
  }

  const holders = data?.holders ?? [];

  if (holders.length === 0) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Aucun porteur indexé pour l&apos;instant.</p>;
  }

  return (
    <div className="w-full max-w-3xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/[.08] text-left text-zinc-500 dark:border-white/[.145] dark:text-zinc-400">
            <th className="py-2 pr-4 font-medium">Porteur</th>
            <th className="py-2 pr-4 font-medium">Pays</th>
            <th className="py-2 pr-4 font-medium">Solde</th>
            <th className="py-2 pr-4 font-medium">Gelé</th>
            <th className="py-2 font-medium">Transférable</th>
          </tr>
        </thead>
        <tbody>
          {holders.map((h) => (
            <tr key={h.address} className="border-b border-black/[.04] dark:border-white/[.08]">
              <td className="py-2 pr-4 font-mono text-xs text-zinc-700 dark:text-zinc-300">
                {h.address.slice(0, 6)}…{h.address.slice(-4)}
              </td>
              <td className="py-2 pr-4">{h.countryName ?? "—"}</td>
              <td className="py-2 pr-4">{formatTokenAmount(h.balance)}</td>
              <td className="py-2 pr-4">{h.frozenBalance !== "0" ? formatTokenAmount(h.frozenBalance) : "—"}</td>
              <td className="py-2">{formatTokenAmount(h.transferable)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
