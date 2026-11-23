import { explorerPoolUrl } from "@cardano/network";
import { POOL_ID, POOL_TICKER } from "@cardano/pool";
import { formatAda, formatNumber, shortenId } from "@cardano/utils";
import CopyButton from "@components/CopyButton";
import { ExternalLink } from "@components/ui";
import { CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { ReactNode } from "react";
import { DelegateToPool, StopStaking, VoteDelegation, WithdrawRewards } from "./CheckActions";
import { drepKind, Finding, Level, marginCostPerYear, saturation } from "./checkLogic";
import { CheckData, PoolCheck, PoolPerformance } from "./loadCheck";

const LEVEL_STYLE: Record<Level, { icon: ReactNode; border: string }> = {
  problem: { icon: <XCircleIcon className="size-5 shrink-0 text-error" />, border: "border-error/40" },
  warning: { icon: <ExclamationTriangleIcon className="size-5 shrink-0 text-warning" />, border: "border-warning/40" },
  info: { icon: <InformationCircleIcon className="size-5 shrink-0 text-info" />, border: "border-line" },
  ok: { icon: <CheckCircleIcon className="size-5 shrink-0 text-success" />, border: "border-success/30" },
};

const percent = (share: number) => `${formatNumber(share * 100)} %`;

const poolTitle = (pool: PoolCheck) => (pool.ticker ? `[${pool.ticker}] ${pool.name ?? ""}`.trim() : shortenId(pool.poolHash, 10));

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface flex flex-col gap-4 p-5">
      <h2 className="section-label">{title}</h2>
      {children}
    </section>
  );
}

function FindingRow({ finding }: { finding: Finding }) {
  const style = LEVEL_STYLE[finding.level];
  return (
    <li className={`flex gap-3 rounded-field border bg-base-300/40 px-4 py-3 ${style.border}`}>
      {style.icon}
      <div className="min-w-0">
        <p className="text-sm font-medium">{finding.title}</p>
        <p className="mt-0.5 text-sm text-base-content/65">{finding.text}</p>
      </div>
    </li>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-base-content/45">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium tabular-nums">{children}</dd>
    </div>
  );
}

/** One bar per epoch, an epoch without a block keeps a stub so the gap is visible. */
function BlockBars({ performance }: { performance: PoolPerformance }) {
  const most = Math.max(1, ...performance.blocks.map((epoch) => epoch.blocks));
  return (
    <div className="flex h-12 items-end gap-1" role="img" aria-label={`Blocks per epoch: ${performance.blocks.map((epoch) => `${epoch.epoch}: ${epoch.blocks}`).join(", ")}`}>
      {performance.blocks.map((epoch) => (
        <div
          key={epoch.epoch}
          title={`Epoch ${epoch.epoch}: ${epoch.blocks} block${epoch.blocks === 1 ? "" : "s"}`}
          className={`w-full max-w-6 rounded-sm ${epoch.blocks > 0 ? "bg-primary/80" : "bg-base-content/15"}`}
          style={{ height: epoch.blocks > 0 ? `${Math.max(18, (epoch.blocks / most) * 100)}%` : "8%" }}
        />
      ))}
    </div>
  );
}

function PoolFacts({ pool, performance }: { pool: PoolCheck; performance: PoolPerformance | null }) {
  const blocks = performance?.blocks.reduce((sum, epoch) => sum + epoch.blocks, 0);
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        <Fact label="Margin">{percent(pool.margin)}</Fact>
        <Fact label="Fixed fee per epoch">{formatAda(pool.fixedCost)}</Fact>
        <Fact label="Stake">{formatAda(pool.activeStake)}</Fact>
        <Fact label="Saturation">{percent(saturation(pool))}</Fact>
        <Fact label="Delegators">{formatNumber(pool.delegators)}</Fact>
        <Fact label="Pledge">{formatAda(pool.pledge)}</Fact>
        {performance ? (
          <>
            <Fact label={`Return, epochs ${performance.fromEpoch} to ${performance.toEpoch}`}>{performance.roa != null ? `${formatNumber(performance.roa)} % per year` : "no rewards"}</Fact>
            <Fact label="Network average">{formatNumber(performance.networkRoa)} % per year</Fact>
          </>
        ) : null}
      </dl>
      {performance ? (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] uppercase tracking-wide text-base-content/45">
            {blocks} block{blocks === 1 ? "" : "s"} in the last {performance.blocks.length} epochs, {formatNumber(performance.lifetimeBlocks)} in total
          </p>
          <BlockBars performance={performance} />
        </div>
      ) : null}
    </>
  );
}

/** Explains the check to someone who opens a shared link, and what the page cannot know. */
const DISCLAIMER = "Chain data as of the current epoch. A short-term return says little about a small pool, its blocks come irregularly. This is information, not financial advice.";

export default function CheckResult({ data }: { data: CheckData }) {
  const { check, known, performance, findings, alternatives, stakeAddress, label } = data;
  const sharePath = `/check/${encodeURIComponent(label)}`;

  const pool = check.pool ?? null;
  const stake = check.balance + check.rewardsAvailable;
  const vote = drepKind(check.drepId);
  const marginCost = pool ? marginCostPerYear(stake, pool.margin, performance?.roa ?? performance?.networkRoa ?? 0) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-brand truncate text-xl font-semibold tracking-tight">{label.startsWith("$") ? label : shortenId(stakeAddress, 14)}</p>
          <p className="text-sm text-base-content/55">{known ? `${formatAda(stake)} staked or stakeable, epoch ${check.currentEpoch}` : "A new address, the chain has not seen it yet"}</p>
        </div>
        <CopyButton text={`https://cardano-tools.io${sharePath}`}>Copy link to this check</CopyButton>
      </div>

      <Card title="Stake pool">
        {!check.registered ? (
          <ul className="flex flex-col gap-2">
            <FindingRow
              finding={{
                level: "problem",
                title: "This address is not delegated yet",
                text: `${stake > 0 ? `Its ${formatAda(stake)} earn no staking rewards.` : "It holds no ADA yet, and what arrives earns no staking rewards."} Delegate to [${POOL_TICKER}] or one of the other pools below: it is one transaction, the ADA stays in the wallet, and the 2 ₳ deposit for registering the stake key comes back when you stop staking.`,
              }}
            />
          </ul>
        ) : !pool ? (
          <ul className="flex flex-col gap-2">
            <FindingRow finding={{ level: "problem", title: "This address is not delegated to a pool", text: "The stake key is registered but points to no pool, so it earns no rewards." }} />
          </ul>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-semibold tracking-tight">{poolTitle(pool)}</p>
              <ExternalLink href={explorerPoolUrl(pool.poolHash)}>cexplorer</ExternalLink>
            </div>
            <ul className="flex flex-col gap-2">
              {findings.map((finding) => (
                <FindingRow key={finding.title} finding={finding} />
              ))}
            </ul>
            <PoolFacts pool={pool} performance={performance} />
          </>
        )}
      </Card>

      {pool && check.registered ? (
        <Card title="What the pool's margin costs you">
          <p className="text-lg font-semibold tracking-tight">{pool.margin > 0 ? `About ${formatAda(marginCost)} per year` : "Nothing, the pool takes no margin"}</p>
          <p className="text-xs text-base-content/55">
            {pool.margin > 0
              ? `Estimated for ${formatAda(stake)} from the pool's returns of the last epochs, compared with a pool that takes 0 %. `
              : ""}
            The margin is the share of the rewards a pool keeps. The return shown above is what delegators received after the margin and the fixed fee of {formatAda(pool.fixedCost)} per
            epoch, which nearly every pool takes.
          </p>
        </Card>
      ) : null}

      {check.registered ? (
        <Card title="Governance vote">
          <ul className="flex flex-col gap-2">
            {vote === "none" ? (
              <FindingRow
                finding={{
                  level: "warning",
                  title: "No vote delegation",
                  text: "Since the Conway era staking rewards can only be withdrawn once the stake key has delegated its vote. Choosing to abstain is enough, it costs only the transaction fee and can be changed at any time.",
                }}
              />
            ) : (
              <FindingRow
                finding={{
                  level: "ok",
                  title: vote === "abstain" ? "The vote always abstains" : vote === "no_confidence" ? "The vote is always no confidence" : "The vote is delegated to a DRep",
                  text: vote === "drep" ? `${check.drepId}. Rewards can be withdrawn.` : "Rewards can be withdrawn.",
                }}
              />
            )}
          </ul>
          <details className="text-sm" open={vote === "none"}>
            <summary className="cursor-pointer text-base-content/65">{vote === "none" ? "Delegate the vote" : "Change the vote delegation"}</summary>
            <div className="mt-3">
              <VoteDelegation stakeAddress={stakeAddress} current={check.drepId} />
            </div>
          </details>
        </Card>
      ) : null}

      {check.registered ? (
        <Card title="Rewards">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-brand text-2xl font-semibold tracking-tight">{formatAda(check.rewardsAvailable)}</p>
              <p className="text-sm text-base-content/55">
                {check.rewardsAvailable > 0 ? "waiting to be withdrawn. They already count for staking, withdrawing only moves them into the spendable balance." : "Nothing to withdraw right now."}
              </p>
            </div>
            {check.rewardsAvailable > 0 && vote !== "none" ? <WithdrawRewards stakeAddress={stakeAddress} lovelace={check.rewardsAvailable} /> : null}
          </div>
          {check.rewardsAvailable > 0 && vote === "none" ? <p className="text-xs text-warning">Withdrawing needs a vote delegation first, see above.</p> : null}
        </Card>
      ) : null}

      {alternatives.length > 0 ? (
        <Card title={pool ? "Pools to consider instead" : "Pools to consider"}>
          <p className="text-sm text-base-content/65">
            A few of the pools that make blocks, are not retiring, take at most 1 % margin with the minimum fixed fee and hold 300 thousand to 30 million ₳. The selection is random
            per address, apart from [TOOLS], the pool that runs and funds this site. Switching is one transaction, the ADA never leaves the wallet.
          </p>
          <ul className="flex flex-col gap-3">
            {alternatives.map(({ pool: option, performance: results }) => (
              <li key={option.poolHash} className="flex flex-col gap-3 rounded-field border border-line bg-base-300/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold">
                    {poolTitle(option)}
                    {option.poolHash === POOL_ID ? <span className="ml-2 text-xs font-normal text-base-content/55">runs this site</span> : null}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <ExternalLink href={explorerPoolUrl(option.poolHash)}>cexplorer</ExternalLink>
                    <DelegateToPool stakeAddress={stakeAddress} poolHash={option.poolHash} ticker={option.ticker ?? "pool"} prominent={option.poolHash === POOL_ID} />
                  </div>
                </div>
                <PoolFacts pool={option} performance={results} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {check.registered ? (
        <Card title="Stop staking">
          <p className="text-sm text-base-content/65">
            For closing a wallet: deregistering the stake key ends the delegation to the pool and the vote delegation, pays out the rewards and returns the 2 ₳ deposit that was
            taken when the key was registered. Many wallets have no button for this. Switching pools does not need it.
          </p>
          <div>
            <StopStaking stakeAddress={stakeAddress} rewards={check.rewardsAvailable} />
          </div>
        </Card>
      ) : null}

      <p className="text-xs text-base-content/45">{DISCLAIMER}</p>
    </div>
  );
}
