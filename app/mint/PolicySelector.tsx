"use client";

import { policySecondsLeft, walletPolicies } from "@cardano/mint";
import { MintPolicy } from "@cardano/types";
import { shortenId } from "@cardano/utils";
import { useEffect, useMemo } from "react";

function formatTimeLeft(seconds: number) {
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return `locks in ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(seconds / 3600);
  return `locks in ${hours} h`;
}

export default function PolicySelector({ keyHash, selected, onSelect }: { keyHash: string; selected: MintPolicy | null; onSelect: (policy: MintPolicy | null) => void }) {
  const policies = useMemo(() => walletPolicies(keyHash), [keyHash]);

  useEffect(() => {
    const nextYear = new Date().getUTCFullYear() + 1;
    onSelect(policies.find((policy) => policy.lockYear === nextYear) ?? policies[0] ?? null);
  }, [keyHash, onSelect, policies]);

  return (
    <div className="surface flex flex-col gap-4 p-5">
      <div>
        <p className="section-label">Policy</p>
        <p className="mt-1 text-sm text-base-content/55">Derived from your wallet key and lock year. Same pair always produces the same policy — nothing is stored in this browser.</p>
      </div>

      <select
        className="select w-full border-line bg-base-300"
        value={selected?.policyId ?? ""}
        onChange={(e) => onSelect(policies.find((policy) => policy.policyId === e.target.value) ?? null)}
      >
        {policies.map((policy) => (
          <option key={policy.policyId} value={policy.policyId}>
            Locks 1 Jan {policy.lockYear + 1} · {shortenId(policy.policyId, 8)} · {formatTimeLeft(policySecondsLeft(policy))}
          </option>
        ))}
      </select>

      {selected ? <p className="break-all font-mono text-xs text-base-content/45">{selected.policyId}</p> : null}
    </div>
  );
}
