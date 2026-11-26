"use client";

import { inputClass } from "@components/ui";
import { useHandle } from "@components/useHandles";
import { useWallet } from "@components/useWallet";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

/**
 * Takes an address, a handle or the connected wallet to the page for it: `/check/<address>` by default, or the page
 * of another section that shows something per address.
 */
export default function CheckForm({ initial = "", base = "/check", submitLabel = "Check" }: { initial?: string; base?: string; submitLabel?: string }) {
  // a `$handle` reads better in a link than the address behind it
  const checkPath = (address: string) => `${base}/${encodeURIComponent(address)}`;
  const router = useRouter();
  const { wallet } = useWallet();
  const walletHandle = useHandle(wallet?.stakeAddress);
  // null until something is typed: the field then holds the checked address or the connected wallet
  const [typed, setInput] = useState<string | null>(null);
  // a checked stake address that owns a handle is shown as that handle
  const initialHandle = useHandle(initial.startsWith("stake") ? initial : undefined);
  const input = typed ?? (initialHandle || initial || walletHandle || wallet?.stakeAddress || "");

  // on the empty page a connected wallet is checked right away, whether it was connected before or just now.
  // Another address can still be checked from the field of the result page.
  const walletAddress = wallet?.stakeAddress;
  useEffect(() => {
    if (walletAddress && !initial) router.replace(`${base}/${encodeURIComponent(walletAddress)}`);
  }, [walletAddress, initial, base, router]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const address = input.trim();
    if (address) router.push(checkPath(address));
  };

  return (
    <form onSubmit={submit} className="flex gap-2">
      <label className={`${inputClass} min-w-0 bg-base-200`}>
        <MagnifyingGlassIcon className="size-4 shrink-0 text-base-content/45" />
        <input className="min-w-0 grow text-sm" value={input} onChange={(e) => setInput(e.target.value)} placeholder="stake1…, addr1… or $handle" aria-label="Address or handle" />
      </label>
      <button className="btn btn-primary shrink-0" type="submit" disabled={!input.trim()}>
        {submitLabel}
      </button>
    </form>
  );
}
