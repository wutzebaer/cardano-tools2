"use client";

import { ConnectedWallet, useWallet } from "@components/useWallet";
import { ReactNode } from "react";

/** Renders its children with the connected wallet, or a prompt to connect one. */
export default function ConnectWallet({ message, children }: { message: string; children: (wallet: ConnectedWallet) => ReactNode }) {
  const { wallet, connect, connecting } = useWallet();

  if (wallet) {
    return <>{children(wallet)}</>;
  }

  return (
    <div className="surface flex flex-col items-center gap-4 px-6 py-16 text-center">
      <p className="text-sm text-base-content/55">{message}</p>
      {connecting ? (
        <button className="btn btn-primary" disabled>
          <span className="loading loading-spinner loading-sm" />
          Connecting…
        </button>
      ) : (
        <button className="btn btn-primary" onClick={connect}>
          Connect wallet
        </button>
      )}
    </div>
  );
}
