"use client";

import { watchConfirmation } from "@cardano/confirmation";
import { getStakeInfo } from "@cardano/dbsync";
import { POOL_ID } from "@cardano/pool";
import { StakeInfo } from "@cardano/types";
import { useWallet } from "@components/useWallet";
import { useEffect, useState, useSyncExternalStore } from "react";

/** The API keeps stake info for a minute, so the answer right after the confirmation may still be the old one. */
const RELOAD_AFTER_MS = [0, 20_000, 40_000, 65_000];

let revision = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function reloadStakeInfo() {
  revision++;
  listeners.forEach((listener) => listener());
}

/** Follows a submitted delegation and makes every part of the page load the stake info again once it is on-chain. */
export function watchDelegation(txHash: string) {
  watchConfirmation(txHash, () => RELOAD_AFTER_MS.forEach((delay) => setTimeout(reloadStakeInfo, delay)));
}

/** Where the connected wallet is delegated, null while unknown or without a wallet. */
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

  const info = stakeAddress && loaded?.stakeAddress === stakeAddress ? loaded.info : null;
  return { info, delegatedHere: info?.poolHash === POOL_ID };
}
