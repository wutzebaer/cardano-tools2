import { epochStartUnix } from "@cardano/network";
import { POOL_ID, POOL_TICKER } from "@cardano/pool";
import { formatAda, shortenId } from "@cardano/utils";
import LocalTime from "@components/LocalTime";
import { ExternalLink } from "@components/ui";
import Link from "next/link";
import { ReactNode } from "react";
import { ActionState, actionStatus, actionTitle, poolsVoteOn, typeLabel, typeText, voteOfAddress, voteOfPool } from "./governanceLogic";
import { GovAction, GovernanceData } from "./loadGovernance";

const STATE_STYLE: Record<ActionState, string> = {
  open: "border-primary/50 text-primary",
  ratified: "border-success/50 text-success",
  enacted: "border-success/50 text-success",
  expired: "border-line text-base-content/55",
  dropped: "border-line text-base-content/55",
};

const VOTE_STYLE: Record<string, string> = { Yes: "text-success", No: "text-error", Abstain: "text-base-content/65" };

const SUMMARY_LENGTH = 320;

/** When an action was submitted and until when it can be voted on, or when it was decided. */
function ActionDates({ action, state }: { action: GovAction; state: ActionState }) {
  // an action is decided at the boundary that begins the epoch the chain names
  const decidedEpoch = action.ratifiedEpoch ?? action.expiredEpoch ?? action.droppedEpoch ?? action.enactedEpoch;
  const open = state === "open" || decidedEpoch == null;
  return (
    <p className="mt-1 text-xs text-base-content/55">
      {action.submittedUnix ? (
        <>
          Submitted <LocalTime unix={action.submittedUnix} /> ·{" "}
        </>
      ) : null}
      {open ? (state === "open" ? "voting until " : "voting ended ") : "decided "}
      <LocalTime unix={epochStartUnix(open ? action.expiresEpoch + 1 : decidedEpoch)} time />
    </p>
  );
}

function Tally({ label, yes, no, abstain }: { label: string; yes: number; no: number; abstain?: number }) {
  const total = yes + no + (abstain ?? 0);
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-base-content/45">{label}</dt>
      <dd className="mt-0.5 text-sm tabular-nums">
        {total === 0 ? (
          <span className="text-base-content/45">no votes</span>
        ) : (
          <>
            <span className="text-success">{yes} yes</span> · <span className="text-error">{no} no</span>
            {abstain != null ? <span className="text-base-content/55"> · {abstain} abstain</span> : null}
          </>
        )}
      </dd>
    </div>
  );
}

function VoteLine({ who, vote, text, children }: { who: ReactNode; vote?: string | null; text: string; children?: ReactNode }) {
  return (
    <p className="text-sm">
      <span className="text-base-content/65">{who}: </span>
      <span className={`font-medium ${vote ? (VOTE_STYLE[vote] ?? "") : "text-base-content/65"}`}>{text}</span>
      {children}
    </p>
  );
}

function Action({ action, data }: { action: GovAction; data: GovernanceData }) {
  const { voter, currentEpoch } = data;
  const status = actionStatus(action, currentEpoch);
  const summary = action.summary?.trim();
  const poolName = voter.poolHash === POOL_ID ? `[${POOL_TICKER}]` : voter.poolTicker ? `[${voter.poolTicker}]` : "The pool";

  return (
    <li className="surface flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-base-content/45" title={typeText(action.type)}>
            {typeLabel(action.type)}
            {action.withdrawal ? ` · ${formatAda(action.withdrawal)}` : ""}
          </p>
          <h2 className="mt-1 break-words text-lg font-semibold tracking-tight">{actionTitle(action)}</h2>
          <ActionDates action={action} state={status.state} />
        </div>
        <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${STATE_STYLE[status.state]}`}>{status.label}</span>
      </div>

      <p className="text-sm text-base-content/65">
        {typeText(action.type)} {status.text}
      </p>
      {summary ? <p className="text-sm leading-relaxed text-base-content/65">{summary.length > SUMMARY_LENGTH ? `${summary.slice(0, SUMMARY_LENGTH).trimEnd()}…` : summary}</p> : null}

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
        <Tally label="Representatives (DReps)" yes={action.drepYes} no={action.drepNo} abstain={action.drepAbstain} />
        {poolsVoteOn(action.type) ? <Tally label="Stake pools" yes={action.poolYes} no={action.poolNo} abstain={action.poolAbstain} /> : null}
        <Tally label="Constitutional committee" yes={action.committeeYes} no={action.committeeNo} />
      </dl>

      <div className="flex flex-col gap-1 rounded-field border border-line bg-base-300/40 px-4 py-3">
        {voter.stakeAddress || voter.drepOnly ? (
          <VoteLine
            who={voter.drepOnly ? (voter.drepName ?? "This DRep") : voter.vote === "drep" ? `Your representative${voter.drepName ? ` ${voter.drepName}` : ""}` : "Your vote"}
            vote={voter.vote === "drep" ? action.drepVote : null}
            text={voteOfAddress(voter.vote, action.drepVote, status.state)}
          />
        ) : null}
        {voter.poolHash ? (
          <VoteLine who={voter.stakeAddress ? `Your pool ${poolName}` : `This site's pool ${poolName}`} vote={action.poolVote} text={voteOfPool(action.type, action.poolVote, status.state)}>
            {action.poolVote && action.poolVoteAnchorUrl?.startsWith("https://") ? (
              <>
                {" · "}
                <a href={action.poolVoteAnchorUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  its reasons
                </a>
              </>
            ) : null}
          </VoteLine>
        ) : voter.stakeAddress ? (
          <VoteLine who="Your pool" text="this address is not delegated to a pool" />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <ExternalLink href={`https://gov.tools/governance_actions/${action.txHash}#${action.index}`}>gov.tools</ExternalLink>
        {action.anchorUrl?.startsWith("https://") ? <ExternalLink href={action.anchorUrl}>Full text</ExternalLink> : null}
      </div>
    </li>
  );
}

export default function GovernanceView({ data }: { data: GovernanceData }) {
  const { voter, actions, currentEpoch } = data;
  const open = actions.filter((action) => actionStatus(action, currentEpoch).state === "open");
  const closed = actions.filter((action) => actionStatus(action, currentEpoch).state !== "open");

  return (
    <div className="flex flex-col gap-8">
      {voter.drepOnly && voter.drepId ? (
        <div className="surface flex flex-col gap-2 p-5 text-sm">
          <p className="text-brand truncate text-xl font-semibold tracking-tight">{voter.drepName ?? shortenId(voter.drepId, 14)}</p>
          <p className="text-base-content/65">How this representative (DRep) voted on the open proposals and on those that ended lately.</p>
          <div>
            <ExternalLink href={`https://gov.tools/drep_directory/${voter.drepId}`}>gov.tools</ExternalLink>
          </div>
        </div>
      ) : null}

      {voter.stakeAddress ? (
        <div className="surface flex flex-col gap-2 p-5 text-sm">
          <p className="text-brand truncate text-xl font-semibold tracking-tight">{voter.label?.startsWith("$") ? voter.label : shortenId(voter.stakeAddress, 14)}</p>
          <p className="text-base-content/65">
            {voter.vote === "drep"
              ? `A representative votes with the weight of this address: ${voter.drepName ?? shortenId(voter.drepId ?? "", 10)}.`
              : voter.vote === "abstain"
                ? "This address has chosen not to take part in votes."
                : voter.vote === "no_confidence"
                  ? "The ADA of this address always counts as a vote of no confidence in the committee."
                  : "This address has not chosen what happens with its voting rights, so its ADA is not counted in any vote."}{" "}
            <Link href={`/check/${encodeURIComponent(voter.label ?? voter.stakeAddress)}`} className="text-primary hover:underline">
              {voter.vote === "none" ? "Make the choice in the staking check" : "Change it in the staking check"}
            </Link>
          </p>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <p className="section-label">Open for voting ({open.length})</p>
        {open.length === 0 ? <p className="surface px-5 py-8 text-center text-sm text-base-content/55">No proposal is open for voting right now.</p> : null}
        <ul className="flex flex-col gap-3">
          {open.map((action) => (
            <Action key={`${action.txHash}#${action.index}`} action={action} data={data} />
          ))}
        </ul>
      </section>

      {closed.length > 0 ? (
        <section className="flex flex-col gap-3">
          <p className="section-label">Decided in the last 90 days ({closed.length})</p>
          <ul className="flex flex-col gap-3">
            {closed.map((action) => (
              <Action key={`${action.txHash}#${action.index}`} action={action} data={data} />
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs text-base-content/45">
        Chain data as of epoch {currentEpoch}. The numbers count voters by their latest vote, they are not weighted by the ADA behind them, which is what decides. Stake pools
        vote on some kinds of proposals only.
      </p>
    </div>
  );
}
