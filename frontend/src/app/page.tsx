"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 font-sans dark:bg-black">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Registre de porteurs T-REX
        </h1>
        <p className="max-w-md text-zinc-600 dark:text-zinc-400">
          Interface du registre de porteurs ERC-3643, alimentée par l&apos;indexeur
          Ponder du dossier <code>backend</code>.
        </p>
      </div>

      {isConnected ? (
        <div className="flex flex-col items-center gap-3">
          <p className="font-mono text-sm text-zinc-700 dark:text-zinc-300">
            {address}
          </p>
          <button
            onClick={() => disconnect()}
            className="rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-white/[.08]"
          >
            Déconnecter
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Connecter {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
