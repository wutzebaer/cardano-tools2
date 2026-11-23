"use client";

import { inputClass } from "@components/ui";
import { useHandle } from "@components/useHandles";
import { useWallet } from "@components/useWallet";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

/** A `$handle` reads better in a link than the address behind it. */
export const checkPath = (address: string) => `/check/${encodeURIComponent(address)}`;

/** Takes an address, a handle or the connected wallet to the page of its check. */
export default function CheckForm({ initial = "" }: { initial?: string }) {
  const router = useRouter();
  const { wallet, connect, connecting } = useWallet();
  const walletHandle = useHandle(wallet?.stakeAddress);
  // null until something is typed: the field then holds the checked address or the connected wallet
  const [typed, setInput] = useState<string | null>(null);
  const input = typed ?? (initial || walletHandle || wallet?.stakeAddress || "");
  const [waitingForWallet, setWaitingForWallet] = useState(false);

  // on the empty page a connected wallet is checked right away, whether it was connected before or just now by "Check my wallet".
  // Another address can still be checked from the field of the result page.
  const walletAddress = wallet?.stakeAddress;
  useEffect(() => {
    if (!walletAddress) return;
    if (waitingForWallet) router.push(checkPath(walletAddress));
    else if (!initial) router.replace(checkPath(walletAddress));
  }, [waitingForWallet, walletAddress, initial, router]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const address = input.trim();
    if (address) router.push(checkPath(address));
  };

  const useWalletAddress = async () => {
    setWaitingForWallet(true);
    await connect().catch(() => setWaitingForWallet(false));
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <label className={`${inputClass} bg-base-200`}>
        <MagnifyingGlassIcon className="size-4 shrink-0 text-base-content/45" />
        <input className="grow text-sm" value={input} onChange={(e) => setInput(e.target.value)} placeholder="stake1…, addr1… or $handle" aria-label="Address or handle" />
      </label>
      <button className="btn btn-primary" type="submit" disabled={!input.trim()}>
        Check
      </button>
      {/* a connected wallet is in the field already */}
      {!wallet ? (
        <button className="btn border-line bg-base-300" type="button" onClick={useWalletAddress} disabled={connecting && waitingForWallet}>
          {connecting && waitingForWallet ? <span className="loading loading-spinner loading-xs" /> : null}
          Check my wallet
        </button>
      ) : null}
    </form>
  );
}
