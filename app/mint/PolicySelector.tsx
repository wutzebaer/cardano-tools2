"use client";

import { createPolicy, policySecondsLeft } from "@cardano/mint";
import { importPolicy } from "@cardano/policies";
import { collectionNameError } from "@cardano/registration";
import { MintPolicy } from "@cardano/types";
import { Field, inputClass, secondaryButtonClass, textareaClass } from "@components/ui";
import { ArrowDownTrayIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useState, ReactNode } from "react";
import { PolicySelection } from "./usePolicies";

function formatTimeLeft(seconds: number) {
  if (!Number.isFinite(seconds)) return "no lock";
  if (seconds <= 0) return "locked";
  const days = Math.floor(seconds / 86400);
  if (days >= 1) return `locks in ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(seconds / 3600);
  return `locks in ${hours} h`;
}

function policyLabel(policy: MintPolicy, minted: boolean) {
  const status = policy.skey || minted ? formatTimeLeft(policySecondsLeft(policy)) : `not minted yet · ${formatTimeLeft(policySecondsLeft(policy))}`;
  const name = policy.name ? `${policy.name} · ` : "";
  return `${name}${policy.policyId} · ${status}${policy.skey ? " · imported" : ""}`;
}

type Mode = "select" | "create" | "import";

/** `step` shows the policy as a numbered step of a longer form. `children` is shown below the selected policy, for what belongs to it. */
export default function PolicySelector({ keyHash, selection, step, children }: { keyHash: string; selection: PolicySelection; step?: number; children?: ReactNode }) {
  const { policies, minted, stored, selected, loading, select, add, remove } = selection;
  const [mode, setMode] = useState<Mode>("select");
  const [name, setName] = useState("");
  const [days, setDays] = useState("365");
  const [noLock, setNoLock] = useState(false);
  const [script, setScript] = useState("");
  const [signingKey, setSigningKey] = useState("");
  const [importError, setImportError] = useState("");

  const close = () => {
    setMode("select");
    setName("");
    setScript("");
    setSigningKey("");
    setImportError("");
  };

  const create = () => {
    add({ ...createPolicy(keyHash, noLock ? null : Number(days)), name: name.trim() || undefined });
    close();
  };

  const doImport = () => {
    try {
      add(importPolicy(name, script, signingKey));
      close();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    }
  };

  const removeSelected = () => {
    if (selected && confirm(selected.skey ? "Remove this policy and its signing key from this browser? Without a backup of the key it cannot be restored." : "Remove this policy from this browser?")) {
      remove(selected.policyId);
    }
  };

  return (
    <div className="surface flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {step ? (
          <div className="flex items-center gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{step}</span>
            <h3 className="text-base font-semibold tracking-tight">Policy</h3>
          </div>
        ) : (
          <p className="section-label">Policy</p>
        )}
        {mode === "select" ? (
          <div className="flex gap-2">
            <button type="button" className={secondaryButtonClass} onClick={() => setMode("import")}>
              <ArrowDownTrayIcon className="size-4" />
              Import
            </button>
            <button type="button" className={secondaryButtonClass} onClick={() => setMode("create")}>
              <PlusIcon className="size-4" />
              New policy
            </button>
          </div>
        ) : null}
      </div>

      {policies.length > 0 ? (
        <div className="flex gap-2">
          <select
            className="select w-full border-line bg-base-300"
            value={selected?.policyId ?? ""}
            onChange={(e) => select(policies.find((policy) => policy.policyId === e.target.value) ?? null)}
          >
            {policies.map((policy) => (
              <option key={policy.policyId} value={policy.policyId} disabled={policySecondsLeft(policy) <= 0}>
                {policyLabel(policy, minted.has(policy.policyId))}
              </option>
            ))}
          </select>
          {selected && stored.has(selected.policyId) ? (
            <button type="button" className="btn btn-ghost btn-square text-base-content/55 hover:text-error" onClick={removeSelected} aria-label="Remove policy from this browser">
              <TrashIcon className="size-4" />
            </button>
          ) : null}
        </div>
      ) : loading ? (
        <span className="loading loading-spinner loading-sm text-primary" />
      ) : (
        <p className="text-sm text-base-content/55">No policies yet. Create one to mint.</p>
      )}

      {mode === "select" ? children : null}

      {mode === "create" ? (
        <div className="flex flex-col gap-4 rounded-field border border-line bg-base-300 p-4">
          <p className="text-xs text-base-content/55">
            The policy is signed by your wallet key, nothing secret is stored.{" "}
            {noLock
              ? "Without a lock you can mint and burn its tokens forever."
              : "After the lock date nobody can mint or burn its tokens any more."}
          </p>
          <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
            {/* the name of the policy is the name of its collection, which can be registered on chain with the royalty token */}
            <Field label="Collection name" error={name.trim() ? collectionNameError(name) : undefined}>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="My collection" />
            </Field>
            <Field label="Days until lock">
              <input className={inputClass} type="number" min="1" max="10000" value={noLock ? "" : days} disabled={noLock} onChange={(e) => setDays(e.target.value)} />
            </Field>
            <label className="flex h-10 cursor-pointer items-center gap-2 text-sm whitespace-nowrap">
              <input type="checkbox" className="checkbox checkbox-sm" checked={noLock} onChange={(e) => setNoLock(e.target.checked)} />
              Never lock this policy
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={create} disabled={!!collectionNameError(name) || (!noLock && !(Number(days) >= 1 && Number(days) <= 10000))}>
              Create
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {mode === "import" ? (
        <div className="flex flex-col gap-4 rounded-field border border-line bg-base-300 p-4">
          <p className="text-xs text-base-content/55">
            Import a policy created elsewhere, e.g. with the previous Cardano Tools or cardano-cli. Script and signing key are kept only in this browser and are
            used to sign next to your wallet.
          </p>
          <Field label="Name (optional)">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="My old policy" />
          </Field>
          <Field label="Policy script (JSON)">
            <textarea className={`${textareaClass} font-mono text-xs`} rows={5} value={script} onChange={(e) => setScript(e.target.value)} placeholder='{"type": "all", "scripts": [{"type": "before", "slot": 1}, {"type": "sig", "keyHash": "…"}]}' />
          </Field>
          <Field label="Policy signing key (.skey file content or hex)" error={importError}>
            <textarea className={`${textareaClass} font-mono text-xs`} rows={3} value={signingKey} onChange={(e) => setSigningKey(e.target.value)} placeholder='{"type": "PaymentSigningKeyShelley_ed25519", "cborHex": "5820…"}' />
          </Field>
          <div className="flex gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={doImport} disabled={!script.trim() || !signingKey.trim()}>
              Import
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
