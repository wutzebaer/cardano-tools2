"use client";

import { watchConfirmation } from "@cardano/confirmation";
import { getStakeInfo } from "@cardano/dbsync";
import { POOL_ID } from "@cardano/pool";
import { StakeInfo } from "@cardano/types";
import { useWallet } from "@components/useWallet";
import { useEffect, useState, useSyncExternalStore } from "react";

/** The API keeps stake info for a minute, so the answer right after the confirmation may still be the old one. */
const RELOAD_AFTER_MS = [0, 20_000, 40_000, 65_000];

/** A delegation to the pool submitted from this page. The wallet it belongs to is filled in by the first reader. */
let delegation: { confirmed: boolean; stakeAddress?: string } | null = null;
let revision = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify() {
  revision++;
  listeners.forEach((listener) => listener());
}

/**
 * Follows a submitted delegation to the pool. Every part of the page shows it as pending until it is on-chain
 * and as delegated from then on, without waiting for the stake info to catch up and without a reload.
 */
export function watchDelegation(txHash: string) {
  const submitted = { confirmed: false };
  delegation = submitted;
  notify();
  watchConfirmation(
    txHash,
    () => {
      submitted.confirmed = true;
      // the stake info follows, it brings the rewards and replaces the assumption above
      RELOAD_AFTER_MS.forEach((delay) => setTimeout(notify, delay));
    },
    () => {
      // never seen on-chain, the page asks for the delegation again
      if (delegation === submitted) delegation = null;
      notify();
    }
  );
}

/**
 * Where the connected wallet is delegated, null while unknown or without a wallet.
 * `pending` is set while a delegation submitted from this page waits for its confirmation.
 */
export function useStakeInfo() {
  const { wallet } = useWallet();
  const [loaded, setLoaded] = useState<{ stakeAddress: string; info: StakeInfo | null } | null>(null);
  const stakeAddress = wallet?.stakeAddress;
  const currentRevision = useSyncExternalStore(
    subscribe,
    () => revision,
    () => 0
  );

  useEffect(() => {
    if (!stakeAddress) return;
    // a delegation belongs to the wallet that was connected when it was submitted
    if (delegation && !delegation.stakeAddress) delegation.stakeAddress = stakeAddress;
    let cancelled = false;
    getStakeInfo(stakeAddress)
      // an address that never delegated has no stake info
      .catch(() => null)
      .then((info) => {
        if (!cancelled) setLoaded({ stakeAddress, info: info ?? null });
      });
    return () => {
      cancelled = true;
    };
  }, [stakeAddress, currentRevision]);

  // false while the pool of the connected wallet is still being looked up
  const known = Boolean(stakeAddress) && loaded?.stakeAddress === stakeAddress;
  const info = known ? loaded!.info : null;
  const submitted = delegation && stakeAddress && (delegation.stakeAddress ?? stakeAddress) === stakeAddress ? delegation : null;
  const delegatedHere = info?.poolHash === POOL_ID || submitted?.confirmed === true;
  return { info, known, delegatedHere, pending: Boolean(submitted) && !delegatedHere };
}
