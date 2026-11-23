"use client";

import { getStakeInfo } from "@cardano/dbsync";
import { POOL_ID } from "@cardano/pool";
import { StakeInfo } from "@cardano/types";
import { useWallet } from "@components/useWallet";
import { useEffect, useState } from "react";

/** Where the connected wallet is delegated, null while unknown or without a wallet. */
export function useStakeInfo() {
  const { wallet } = useWallet();
  const [loaded, setLoaded] = useState<{ stakeAddress: string; info: StakeInfo | null } | null>(null);
  const stakeAddress = wallet?.stakeAddress;

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
  }, [stakeAddress]);

  const info = stakeAddress && loaded?.stakeAddress === stakeAddress ? loaded.info : null;
  return { info, delegatedHere: info?.poolHash === POOL_ID };
}
