"use client";

import { watchConfirmation } from "@cardano/confirmation";
import { explorerTxUrl } from "@cardano/network";
import { POOL_ID } from "@cardano/pool";
import { delegateToPool, delegateVote, deregisterStake, VoteTarget, withdrawRewards } from "@cardano/transaction";
import { formatAda } from "@cardano/utils";
import { ExternalLink } from "@components/ui";
import { watchDelegation } from "@components/useStakeInfo";
import { ConnectedWallet, useWallet } from "@components/useWallet";
import { CheckCircleIcon, HandThumbDownIcon, NoSymbolIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { ComponentType, ReactNode, SVGProps, useEffect, useState } from "react";
import DrepPicker from "./DrepPicker";

/** Follows a submitted transaction and refreshes the check once it is on chain. */
function Submitted({ txHash, label, confirmed, onConfirmed }: { txHash: string; label: string; confirmed: boolean; onConfirmed: () => void }) {
  const router = useRouter();
  useEffect(
    () =>
      watchConfirmation(txHash, () => {
        onConfirmed();
        router.refresh();
      }),
    // the callback changes with every render, the transaction is what is followed
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [confirmed, setConfirmed] = useState(false);

  const submitted = txHash ? <Submitted txHash={txHash} label={done} confirmed={confirmed} onConfirmed={() => setConfirmed(true)} /> : null;
  // while the transaction is on its way there is nothing to choose, once it is confirmed the action is back with the new state
  if (submitted && !confirmed) return submitted;
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
      const hash = await send(wallet);
      setConfirmed(false);
      setTxHash(hash);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      {submitted ? <div className="mb-3">{submitted}</div> : null}
      {children(run, busy)}
    </>
  );
}

/** Icon, name and one line of explanation of one of the choices about the voting rights. */
function OptionTitle({ icon: Icon, title, children }: { icon: ComponentType<SVGProps<SVGSVGElement>>; title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-base-content/55" />
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-base-content/65">{children}</p>
      </div>
    </div>
  );
}

/**
 * Delegates the vote of the address: the two automatic choices as buttons, a DRep from the list or by id.
 * `suggested` is preselected in the list: the DRep the operator of the address's pool chose for themselves.
 */
export function VoteDelegation({
  stakeAddress,
  current,
  currentName,
  suggested,
}: {
  stakeAddress: string;
  current?: string | null;
  currentName?: string | null;
  suggested?: { drepId: string; name?: string | null; poolTicker?: string | null } | null;
}) {
  // what was chosen here a moment ago counts before the chain data says so, which lags a little behind
  const [sent, setSent] = useState<string | null>(null);
  const chosen = sent ?? current;
  // the DRep the address already delegates to, else the suggestion
  const currentDrep = chosen?.startsWith("drep1") ? chosen : null;
  const [drepId, setDrepId] = useState(currentDrep ?? suggested?.drepId ?? "");
  const isSuggestion = suggested != null && drepId === suggested.drepId && drepId !== currentDrep;
  return (
    <OwnerAction stakeAddress={stakeAddress} done="Your choice">
      {(run, busy) => {
        const send = (target: VoteTarget) =>
          run(async (wallet) => {
            const hash = await delegateVote(wallet.connection, target);
            setSent(target === "abstain" ? "drep_always_abstain" : target === "no_confidence" ? "drep_always_no_confidence" : target);
            return hash;
          });
        return (
          <ul className="flex flex-col gap-3">
            {/* the representative comes first and stands out: taking part is what the vote is for */}
            <li className="flex flex-col gap-3 rounded-field border border-line-strong bg-base-300/40 p-4">
              <OptionTitle icon={UserGroupIcon} title="A representative votes for me">
                With the weight of your ADA, the ADA itself stays with you.{" "}
                <a href="https://gov.tools/drep_directory" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Browse all on gov.tools
                </a>
              </OptionTitle>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <DrepPicker value={drepId} onChange={setDrepId} knownName={drepId === currentDrep ? currentName : drepId === suggested?.drepId ? suggested.name : null} />
                <button className="btn btn-brand btn-sm shrink-0 sm:mt-1" disabled={busy || !drepId.trim().startsWith("drep1") || drepId === currentDrep} onClick={() => send(drepId)}>
                  {drepId === currentDrep ? "Chosen" : "Choose this DRep"}
                </button>
              </div>
              {isSuggestion ? (
                <p className="text-xs text-base-content/55">
                  Preselected: the DRep the operator of your pool{suggested?.poolTicker ? ` [${suggested.poolTicker}]` : ""} chose. A starting point, not a recommendation.
                </p>
              ) : null}
            </li>
            <li className="flex flex-col gap-2 rounded-field border border-line bg-base-300/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <OptionTitle icon={NoSymbolIcon} title="I do not want to take part">
                Your ADA is not counted in any vote. Called &quot;abstain&quot; on Cardano.
              </OptionTitle>
              <button className="btn btn-sm shrink-0 border-line bg-base-300" disabled={busy || chosen === "drep_always_abstain"} onClick={() => send("abstain")}>
                {chosen === "drep_always_abstain" ? "Chosen" : "Choose this"}
              </button>
            </li>
            <li className="flex flex-col gap-2 rounded-field border border-line bg-base-300/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <OptionTitle icon={HandThumbDownIcon} title="I have no confidence in the current committee">
                Always counts as a vote to replace the committee that guards the constitution. A political statement.
              </OptionTitle>
              <button className="btn btn-sm shrink-0 border-line bg-base-300" disabled={busy || chosen === "drep_always_no_confidence"} onClick={() => send("no_confidence")}>
                {chosen === "drep_always_no_confidence" ? "Chosen" : "Choose this"}
              </button>
            </li>
          </ul>
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
        This address still has {formatAda(rewards)} of rewards, which have to be paid out with the deregistration. Cardano only pays rewards out once the choice under
        &quot;Your voting rights&quot; above is made: make it, wait for the confirmation and come back here.
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
            if (!confirm("Stop staking with this wallet?\n\nThe stake key is deregistered: the delegation to the pool and the choice about the voting rights end, the rewards are paid out and the 2 ₳ deposit comes back. Staking again later means registering again.")) return;
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
