import { getMints } from "@cardano/dbsync";
import { createPolicy, policiesFromMints, policySecondsLeft } from "@cardano/mint";
import { MintPolicy } from "@cardano/types";
import { shortenId } from "@cardano/utils";
import { PlusIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

function formatTimeLeft(seconds: number) {
  if (!Number.isFinite(seconds)) return "no lock";
  if (seconds <= 0) return "locked";
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return `locks in ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(seconds / 3600);
  return `locks in ${hours} h`;
}

function policyLabel(policy: MintPolicy, onChain: boolean) {
  const status = onChain ? formatTimeLeft(policySecondsLeft(policy)) : "not minted yet";
  return `${shortenId(policy.policyId, 8)} · ${status}`;
}

const NO_POLICIES: MintPolicy[] = [];

export default function PolicySelector({
  keyHash,
  stakeAddress,
  selected,
  onSelect,
}: {
  keyHash: string;
  stakeAddress: string;
  selected: MintPolicy | null;
  onSelect: (policy: MintPolicy | null) => void;
}) {
  const [loadedPolicies, setLoadedPolicies] = useState<MintPolicy[]>([]);
  const [creating, setCreating] = useState(false);
  const [days, setDays] = useState("365");

  useEffect(() => {
    if (!stakeAddress) return;
    let cancelled = false;
    getMints(stakeAddress).then((mints) => {
      if (!cancelled) setLoadedPolicies(policiesFromMints(mints, keyHash));
    });
    return () => {
      cancelled = true;
    };
  }, [stakeAddress, keyHash]);

  const chainPolicies = stakeAddress ? loadedPolicies : NO_POLICIES;

  useEffect(() => {
    if (!selected && chainPolicies[0]) {
      onSelect(chainPolicies[0]);
    }
  }, [chainPolicies, selected, onSelect]);

  const onChain = chainPolicies.some((policy) => policy.policyId === selected?.policyId);
  const options = selected && !onChain ? [...chainPolicies, selected] : chainPolicies;

  const create = () => {
    const policy = createPolicy(keyHash, Number(days));
    onSelect(policy);
    setCreating(false);
  };

  return (
    <div className="surface flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="section-label">Policy</p>
        </div>
        {!creating ? (
          <button type="button" className="btn btn-sm gap-1 border-line bg-base-300 hover:border-line-strong" onClick={() => setCreating(true)}>
            <PlusIcon className="size-4" />
            New policy
          </button>
        ) : null}
      </div>

      {options.length > 0 ? (
        <select
          className="select w-full border-line bg-base-300"
          value={selected?.policyId ?? ""}
          onChange={(e) => onSelect(options.find((policy) => policy.policyId === e.target.value) ?? null)}
        >
          {options.map((policy) => (
            <option key={policy.policyId} value={policy.policyId} disabled={policySecondsLeft(policy) <= 0}>
              {policyLabel(policy, chainPolicies.some((onChainPolicy) => onChainPolicy.policyId === policy.policyId))}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm text-base-content/55">No minted policies yet. Create one to mint.</p>
      )}

      {selected ? <p className="break-all font-mono text-xs text-base-content/45">{selected.policyId}</p> : null}

      {creating ? (
        <div className="flex flex-col gap-3 rounded-field border border-line bg-base-300 p-4 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1 text-xs text-base-content/55">
            Days until lock
            <input className="input w-32 border-line bg-base-200" type="number" min="1" max="10000" value={days} onChange={(e) => setDays(e.target.value)} />
          </label>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={create} disabled={!(Number(days) >= 1)}>
              Create
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
