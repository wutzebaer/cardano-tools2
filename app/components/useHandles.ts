"use client";

import { loadHandles } from "@cardano/handles";
import { useEffect, useMemo, useState } from "react";

const NO_HANDLES: Record<string, string> = {};

/**
 * ADA Handles of the given stake addresses, keyed by stake address. Empty while loading and for
 * addresses without a handle, so callers fall back to the address itself.
 */
export function useHandles(stakeAddresses: (string | null | undefined)[]): Record<string, string> {
  // the list is usually built during render, the joined key keeps the effect from running on every one
  const key = [...new Set(stakeAddresses.filter(Boolean))].sort().join(",");
  const [loaded, setLoaded] = useState<{ key: string; handles: Record<string, string> } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    loadHandles(key.split(",")).then((handles) => {
      if (!cancelled) setLoaded({ key, handles });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return useMemo(() => (loaded?.key === key ? loaded.handles : NO_HANDLES), [loaded, key]);
}

/** "$handle" when the stake address has one, otherwise undefined. */
export function useHandle(stakeAddress: string | null | undefined): string | undefined {
  const handle = useHandles([stakeAddress])[stakeAddress ?? ""];
  return handle ? `$${handle}` : undefined;
}
