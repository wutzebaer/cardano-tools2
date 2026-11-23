"use client";

import { formatNumber, shortenId } from "@cardano/utils";
import { Verified } from "@components/JpgStoreIcons";
import TokenCard from "@components/TokenCard";
import { inputClass, Notice } from "@components/ui";
import { useWallet } from "@components/useWallet";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AddressTokens, loadAddressTokens } from "./loadTokens";

export default function MyTokens() {
  const { wallet, connect } = useWallet();
  const router = useRouter();
  const pathname = usePathname();
  // the searched address lives in the URL, so coming back from a token shows the same list again
  const query = useSearchParams().get("address") ?? "";
  const [input, setInput] = useState(query);
  const [result, setResult] = useState<{ query: string; data?: AddressTokens; error?: string } | null>(null);

  // without an explicit search the connected wallet is shown
  const address = query || wallet?.stakeAddress || "";

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    loadAddressTokens(address)
      .then((data) => ({ query: address, data }))
      .catch((error) => ({ query: address, error: error instanceof Error ? error.message : String(error) }))
      .then((loaded) => {
        if (!cancelled) setResult(loaded);
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const current = result?.query === address ? result : null;
  const loading = Boolean(address) && !current;

  const groups = useMemo(() => {
    const byPolicy = new Map<string, AddressTokens["tokens"]>();
    for (const token of current?.data?.tokens ?? []) {
      byPolicy.set(token.maPolicyId, [...(byPolicy.get(token.maPolicyId) ?? []), token]);
    }
    return [...byPolicy];
  }, [current]);

  const search = (e: FormEvent) => {
    e.preventDefault();
    const address = input.trim();
    router.replace(address ? `${pathname}?address=${encodeURIComponent(address)}` : pathname, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <label className={`${inputClass} bg-base-200`}>
          <MagnifyingGlassIcon className="size-4 shrink-0 text-base-content/45" />
          <input className="grow text-sm" value={input} onChange={(e) => setInput(e.target.value)} placeholder={wallet?.stakeAddress || "stake1…, addr1… or $handle"} />
        </label>
        <button className="btn btn-primary" type="submit">
          Show
        </button>
        {!wallet ? (
          <button className="btn border-line bg-base-300" type="button" onClick={connect}>
            Use my wallet
          </button>
        ) : null}
      </form>

      {!address ? <div className="surface px-6 py-16 text-center text-sm text-base-content/55">Connect a wallet or enter an address to see its tokens.</div> : null}
      {loading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      ) : null}
      {current?.error ? <Notice tone="error">{current.error}</Notice> : null}
      {current?.data && groups.length === 0 ? <div className="surface px-6 py-16 text-center text-sm text-base-content/55">No tokens found.</div> : null}

      {groups.map(([policyId, tokens]) => {
        const collection = current?.data?.collections[policyId];
        return (
          <section key={policyId} className="flex flex-col gap-3">
            <Link href={`/browse/search/${policyId}`} className="flex w-fit items-center gap-1.5 text-sm font-medium hover:text-primary" title={policyId}>
              <span className={collection?.name ? "" : "font-mono"}>{collection?.name ?? shortenId(policyId, 8)}</span>
              {collection?.verified ? <Verified className="size-4" /> : null}
              <span className="text-xs font-normal text-base-content/45">{tokens.length}</span>
            </Link>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-5">
              {tokens.map((token) => (
                <TokenCard key={token.maFingerprint} item={token} collection={collection} footer={token.quantity === 1 ? "1 token" : `${formatNumber(token.quantity)} tokens`} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
