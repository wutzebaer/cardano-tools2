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
  const [input, setInput] = useState(initial);
  const [waitingForWallet, setWaitingForWallet] = useState(false);

  // the wallet was asked for by "Check my wallet" and has arrived
  const walletAddress = wallet?.stakeAddress;
  useEffect(() => {
    if (waitingForWallet && walletAddress) router.push(checkPath(walletAddress));
  }, [waitingForWallet, walletAddress, router]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const address = input.trim();
    if (address) router.push(checkPath(address));
  };

  const useWalletAddress = async () => {
    if (wallet) {
      router.push(checkPath(wallet.stakeAddress));
      return;
    }
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
      <button className="btn border-line bg-base-300" type="button" onClick={useWalletAddress} disabled={connecting && waitingForWallet}>
        {connecting && waitingForWallet ? <span className="loading loading-spinner loading-xs" /> : null}
        {wallet ? `Check ${walletHandle ? `$${walletHandle}` : "my wallet"}` : "Check my wallet"}
      </button>
    </form>
  );
}
