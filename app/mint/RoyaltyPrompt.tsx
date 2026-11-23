"use client";

import { watchConfirmation } from "@cardano/confirmation";
import { explorerTxUrl } from "@cardano/network";
import { isValidAddress, mintRoyaltyToken } from "@cardano/royalties";
import { MintPolicy } from "@cardano/types";
import { ExternalLink, Field, inputClass } from "@components/ui";
import { ConnectedWallet } from "@components/useWallet";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

const SKIPPED_KEY = "royaltySkipped";

function skippedPolicies(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(SKIPPED_KEY) ?? "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

/**
 * Asks for the royalties of a policy that has not minted anything yet, right where its first tokens are about to be
 * minted: marketplaces only honour a royalty token that is the very first token of its policy. Give it a `key` per policy.
 */
export default function RoyaltyPrompt({ wallet, policy }: { wallet: ConnectedWallet; policy: MintPolicy }) {
  const [percent, setPercent] = useState("5");
  const [address, setAddress] = useState(wallet.changeAddress);
  const [minting, setMinting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [skipped, setSkipped] = useState(() => skippedPolicies().includes(policy.policyId));

  useEffect(() => (txHash ? watchConfirmation(txHash, () => setConfirmed(true)) : undefined), [txHash]);

  if (skipped) return null;

  if (txHash) {
    return (
      <div className="flex flex-col gap-2 rounded-field border border-line bg-base-200 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        {confirmed ? (
          <span className="flex items-center gap-2 text-success">
            <CheckCircleIcon className="size-4" />
            Royalty token confirmed, mint your tokens now.
          </span>
        ) : (
          <span className="flex items-center gap-2 text-base-content/65">
            <span className="loading loading-spinner loading-xs" />
            Royalty token submitted. Wait for the confirmation before you mint, it has to be the first token of the policy.
          </span>
        )}
        <ExternalLink href={explorerTxUrl(txHash)}>cexplorer</ExternalLink>
      </div>
    );
  }

  const rate = Number(percent);
  const rateValid = percent.trim() !== "" && rate >= 0 && rate <= 100;
  const addressValid = isValidAddress(address);

  const mint = async () => {
    setMinting(true);
    try {
      setTxHash(await mintRoyaltyToken(wallet.connection, policy, rate, address, wallet.keyHashes));
    } finally {
      setMinting(false);
    }
  };

  const skip = () => {
    localStorage.setItem(SKIPPED_KEY, JSON.stringify([...skippedPolicies().filter((id) => id !== policy.policyId), policy.policyId]));
    setSkipped(true);
  };

  return (
    <div className="flex flex-col gap-3 rounded-field border border-warning/40 bg-base-200 p-4">
      <p className="text-sm text-warning">
        Should sales of this policy&apos;s NFTs pay royalties? Then mint the royalty token now: marketplaces only honour it as the very first token of a policy.
      </p>
      <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <Field label="Royalties in %" error={rateValid ? undefined : "0 to 100"}>
          <input className={inputClass} type="number" min="0" max="100" step="0.5" value={percent} onChange={(e) => setPercent(e.target.value)} />
        </Field>
        <Field label="Address receiving the royalties" error={addressValid ? undefined : "Not a valid address"}>
          <input className={`${inputClass} font-mono text-xs`} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="addr1…" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary btn-sm" disabled={!rateValid || !addressValid || minting} onClick={mint}>
          {minting ? <span className="loading loading-spinner loading-xs" /> : null}
          Mint royalty token
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={minting} onClick={skip}>
          No royalties
        </button>
      </div>
    </div>
  );
}
