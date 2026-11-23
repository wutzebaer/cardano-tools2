"use client";

import { watchConfirmation } from "@cardano/confirmation";
import { explorerTxUrl } from "@cardano/network";
import { POOL_ID } from "@cardano/pool";
import { delegateToPool, delegateVote, deregisterStake, VoteTarget, withdrawRewards } from "@cardano/transaction";
import { formatAda } from "@cardano/utils";
import { ExternalLink, inputClass } from "@components/ui";
import { watchDelegation } from "@components/useStakeInfo";
import { ConnectedWallet, useWallet } from "@components/useWallet";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

/** Follows a submitted transaction and refreshes the check once it is on chain. */
function Submitted({ txHash, label }: { txHash: string; label: string }) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  useEffect(
    () =>
      watchConfirmation(txHash, () => {
        setConfirmed(true);
        router.refresh();
      }),
    [txHash, router]
  );
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {confirmed ? (
        <span className="flex items-center gap-1.5 text-success">
          <CheckCircleIcon className="size-4" />
          {label} confirmed
        </span>
      ) : (
        <span className="flex items-center gap-2 text-base-content/65">
          <span className="loading loading-spinner loading-xs" />
          {label} submitted, waiting for confirmation
        </span>
      )}
      <ExternalLink href={explorerTxUrl(txHash)}>cexplorer</ExternalLink>
    </div>
  );
}

/**
 * An action only the owner of the checked address can take. Without a wallet it offers to connect one,
 * with the wallet of another address it says so instead of building a transaction for the wrong account.
 */
function OwnerAction({
  stakeAddress,
  done,
  connectLabel = "Connect the wallet of this address",
  connectClass = "btn btn-sm border-line bg-base-300",
  children,
}: {
  stakeAddress: string;
  done: string;
  /** What the button says while no wallet is connected, a click on it connects one */
  connectLabel?: string;
  connectClass?: string;
  children: (run: (send: (wallet: ConnectedWallet) => Promise<string>) => void, busy: boolean) => ReactNode;
}) {
  const { wallet, connect, connecting } = useWallet();
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  if (txHash) return <Submitted txHash={txHash} label={done} />;
  if (!wallet) {
    return (
      <button className={connectClass} onClick={connect} disabled={connecting}>
        {connecting ? <span className="loading loading-spinner loading-xs" /> : null}
        {connectLabel}
      </button>
    );
  }
  if (wallet.stakeAddress !== stakeAddress) {
    return <p className="text-xs text-base-content/55">The connected wallet belongs to another address. Connect the wallet of this address to do this here.</p>;
  }

  const run = async (send: (wallet: ConnectedWallet) => Promise<string>) => {
    setBusy(true);
    try {
      setTxHash(await send(wallet));
    } finally {
      setBusy(false);
    }
  };
  return <>{children(run, busy)}</>;
}

/** Delegates the vote of the address: the two automatic choices as buttons, any DRep by id. */
export function VoteDelegation({ stakeAddress, current }: { stakeAddress: string; current?: string | null }) {
  const [drepId, setDrepId] = useState("");
  return (
    <OwnerAction stakeAddress={stakeAddress} done="Vote delegation">
      {(run, busy) => {
        const send = (target: VoteTarget) => run((wallet) => delegateVote(wallet.connection, target));
        return (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary btn-sm" disabled={busy || current === "drep_always_abstain"} onClick={() => send("abstain")}>
                Always abstain
              </button>
              <button className="btn btn-sm border-line bg-base-300" disabled={busy || current === "drep_always_no_confidence"} onClick={() => send("no_confidence")}>
                Always no confidence
              </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input className={`${inputClass} input-sm font-mono text-xs`} value={drepId} onChange={(e) => setDrepId(e.target.value)} placeholder="or the id of a DRep: drep1…" aria-label="DRep id" />
              <button className="btn btn-sm border-line bg-base-300" disabled={busy || !drepId.trim().startsWith("drep1")} onClick={() => send(drepId)}>
                Delegate to this DRep
              </button>
            </div>
          </div>
        );
      }}
    </OwnerAction>
  );
}

export function WithdrawRewards({ stakeAddress, lovelace }: { stakeAddress: string; lovelace: number }) {
  return (
    <OwnerAction stakeAddress={stakeAddress} done="Withdrawal">
      {(run, busy) => (
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run((wallet) => withdrawRewards(wallet.connection, BigInt(lovelace)))}>
          {busy ? <span className="loading loading-spinner loading-xs" /> : null}
          Withdraw {formatAda(lovelace)}
        </button>
      )}
    </OwnerAction>
  );
}

/** Ends staking for good: takes the rewards out and deregisters the stake key, which pays its deposit back. */
export function StopStaking({ stakeAddress, rewards, voteDelegated }: { stakeAddress: string; rewards: number; voteDelegated: boolean }) {
  // the chain deregisters no key with rewards left, and pays rewards out only to a key that has delegated its vote
  if (rewards > 0 && !voteDelegated) {
    return (
      <p className="text-sm text-warning">
        This address still has {formatAda(rewards)} of rewards, which have to be paid out with the deregistration. That needs a vote delegation first: choose &quot;Always
        abstain&quot; above, wait for the confirmation and come back here.
      </p>
    );
  }
  return (
    <OwnerAction stakeAddress={stakeAddress} done="Deregistration">
      {(run, busy) => (
        <button
          className="btn btn-sm border-error/50 bg-error/10 text-error hover:border-error hover:bg-error/20"
          disabled={busy}
          onClick={() => {
            if (!confirm("Stop staking with this wallet?\n\nThe stake key is deregistered: the delegation to the pool and the vote delegation end, the rewards are paid out and the 2 ₳ deposit comes back. Staking again later means registering again.")) return;
            run((wallet) => deregisterStake(wallet.connection, BigInt(rewards)));
          }}
        >
          {busy ? <span className="loading loading-spinner loading-xs" /> : null}
          Stop staking and get the deposit back
        </button>
      )}
    </OwnerAction>
  );
}

/** `prominent` is the filled button, the others are outlined in the same colour so every pool can be picked at a glance. */
export function DelegateToPool({ stakeAddress, poolHash, ticker, prominent = false }: { stakeAddress: string; poolHash: string; ticker: string; prominent?: boolean }) {
  const buttonClass = prominent ? "btn btn-brand btn-sm" : "btn btn-sm border-primary/60 bg-primary/10 text-primary hover:border-primary hover:bg-primary/20";
  return (
    <OwnerAction stakeAddress={stakeAddress} done="Delegation" connectLabel={`Delegate to [${ticker}]`} connectClass={buttonClass}>
      {(run, busy) => (
        <button
          className={buttonClass}
          disabled={busy}
          onClick={() =>
            run(async (wallet) => {
              const txHash = await delegateToPool(wallet.connection, poolHash);
              // the stake box in the sidebar turns into its thank-you for a delegation to this site's pool
              if (poolHash === POOL_ID) watchDelegation(txHash);
              return txHash;
            })
          }
        >
          {busy ? <span className="loading loading-spinner loading-xs" /> : null}
          Delegate to [{ticker}]
        </button>
      )}
    </OwnerAction>
  );
}
