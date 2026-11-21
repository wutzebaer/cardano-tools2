"use client";

import { getMints } from "@cardano/dbsync";
import { canSignPolicy, policiesFromMints, policySecondsLeft } from "@cardano/mint";
import { loadStoredPolicies, removeStoredPolicy, storePolicy } from "@cardano/policies";
import { MintPolicy } from "@cardano/types";
import { ConnectedWallet } from "@components/useWallet";
import { useCallback, useEffect, useMemo, useState } from "react";

const SELECTED_KEY = "policyId";

export interface PolicySelection {
  /** Policies this wallet can sign for: found on-chain plus the ones kept in this browser */
  policies: MintPolicy[];
  /** Policy ids that already have mints on-chain */
  minted: Set<string>;
  /** Policy ids kept in this browser's storage */
  stored: Set<string>;
  selected: MintPolicy | null;
  loading: boolean;
  select: (policy: MintPolicy | null) => void;
  /** Keeps a new or imported policy in this browser and selects it */
  add: (policy: MintPolicy) => void;
  remove: (policyId: string) => void;
}

/** Policies of the connected wallet and which one is selected. */
export function usePolicies(wallet: ConnectedWallet): PolicySelection {
  const { stakeAddress, keyHashes } = wallet;
  const [chain, setChain] = useState<{ stakeAddress: string; policies: MintPolicy[] } | null>(null);
  const [storedPolicies, setStoredPolicies] = useState<MintPolicy[]>(() => loadStoredPolicies());
  const [selectedId, setSelectedId] = useState<string | null>(() => (typeof localStorage === "undefined" ? null : localStorage.getItem(SELECTED_KEY)));

  useEffect(() => {
    if (!stakeAddress) return;
    let cancelled = false;
    getMints(stakeAddress)
      .then((mints) => policiesFromMints(mints, keyHashes))
      // without chain data the policies kept in the browser still work
      .catch(() => [])
      .then((policies) => {
        if (!cancelled) setChain({ stakeAddress, policies });
      });
    return () => {
      cancelled = true;
    };
  }, [stakeAddress, keyHashes]);

  const loading = Boolean(stakeAddress) && chain?.stakeAddress !== stakeAddress;

  const { policies, minted, stored } = useMemo(() => {
    const chainPolicies = chain?.stakeAddress === stakeAddress ? chain.policies : [];
    const minted = new Set(chainPolicies.map((policy) => policy.policyId));
    const signable = storedPolicies.filter((policy) => canSignPolicy(policy, keyHashes));
    const stored = new Set(signable.map((policy) => policy.policyId));
    // stored entries carry the name and, for imported policies, the signing key
    const policies = [...signable, ...chainPolicies.filter((policy) => !stored.has(policy.policyId))];
    return { policies, minted, stored };
  }, [chain, stakeAddress, storedPolicies, keyHashes]);

  const selected = policies.find((policy) => policy.policyId === selectedId) ?? policies.find((policy) => policySecondsLeft(policy) > 0) ?? null;

  const select = useCallback((policy: MintPolicy | null) => {
    setSelectedId(policy?.policyId ?? null);
    if (policy) {
      localStorage.setItem(SELECTED_KEY, policy.policyId);
    } else {
      localStorage.removeItem(SELECTED_KEY);
    }
  }, []);

  const add = useCallback(
    (policy: MintPolicy) => {
      storePolicy(policy);
      setStoredPolicies(loadStoredPolicies());
      select(policy);
    },
    [select]
  );

  const remove = useCallback((policyId: string) => {
    removeStoredPolicy(policyId);
    setStoredPolicies(loadStoredPolicies());
  }, []);

  return { policies, minted, stored, selected, loading, select, add, remove };
}
