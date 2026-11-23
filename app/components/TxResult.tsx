"use client";

import { watchConfirmation } from "@cardano/confirmation";
import { explorerTxUrl } from "@cardano/network";
import { ExternalLink } from "@components/ui";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { ReactNode, useEffect, useState } from "react";

function useConfirmed(txHash: string) {
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => watchConfirmation(txHash, () => setConfirmed(true)), [txHash]);
  return confirmed;
}

function TxRow({ txHash }: { txHash: string }) {
  const confirmed = useConfirmed(txHash);
  return (
    <li className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="break-all font-mono text-[13px]">{txHash}</span>
      <span className="flex shrink-0 items-center gap-3">
        {confirmed ? (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircleIcon className="size-4" />
            confirmed
          </span>
        ) : (
          <span className="flex items-center gap-2 text-xs text-base-content/55">
            <span className="loading loading-spinner loading-xs" />
            waiting for confirmation
          </span>
        )}
        <ExternalLink href={explorerTxUrl(txHash)}>cexplorer</ExternalLink>
      </span>
    </li>
  );
}

/** Success panel after submitting one or more transactions; follows them until they are on-chain. */
export default function TxResult({ title, txHashes, children, onReset, resetLabel }: { title: string; txHashes: string[]; children?: ReactNode; onReset: () => void; resetLabel: string }) {
  return (
    <div className="surface flex flex-col gap-5 p-6">
      <div>
        <h2 className="text-brand text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-base-content/55">It can take a minute until the transaction is on-chain.</p>
      </div>
      <ul className="flex flex-col gap-3">
        {txHashes.map((txHash) => (
          <TxRow key={txHash} txHash={txHash} />
        ))}
      </ul>
      {children}
      <div>
        <button className="btn btn-primary btn-sm" onClick={onReset}>
          {resetLabel}
        </button>
      </div>
    </div>
  );
}
