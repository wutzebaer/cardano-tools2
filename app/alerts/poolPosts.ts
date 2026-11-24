/**
 * What the bot posts about the site's own pool in its Telegram group: the plan of an epoch once it is calculated
 * and the result once the epoch is over. Pure: the worker brings the numbers, the tests do the same.
 */

/** A pool's epoch as the chain data API reports it. */
export interface PoolEpochFacts {
  epoch: number;
  blocks: number;
  /** Lovelace */
  stake: number;
  delegators: number;
  /** Blocks a pool of this stake makes in an average epoch, missing while the epoch has no snapshot */
  expectedBlocks?: number | null;
}

export type PoolPostKind = "plan" | "result";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

export const formatExpected = (blocks: number) => blocks.toLocaleString("en-US", { minimumFractionDigits: blocks < 10 ? 2 : 1, maximumFractionDigits: blocks < 10 ? 2 : 1 });

/** Blocks against what the stake lets expect, in percent. Undefined without an expectation. */
export function luck(blocks: number, expectedBlocks: number | null | undefined) {
  return expectedBlocks != null && expectedBlocks > 0 ? Math.round((blocks / expectedBlocks) * 100) : undefined;
}

export const formatStake = (lovelace: number) => `${Math.round(lovelace / 1_000_000).toLocaleString("en-US")} ₳`;

/**
 * Scheduled blocks per epoch as the leaderlog job publishes them. Only the number leaves the block producer,
 * never the slots: who knows the times could attack the node at exactly those.
 */
export function scheduledBlocks(pushgatewayMetrics: string): Map<number, number> {
  const scheduled = new Map<number, number>();
  for (const line of pushgatewayMetrics.split("\n")) {
    const match = /^cardano_leaderlog_scheduled_blocks\{[^}]*\bepoch="(\d+)"[^}]*\}\s+(\S+)/.exec(line);
    const count = match ? Number(match[2]) : NaN;
    if (match && Number.isInteger(count) && count >= 0) scheduled.set(Number(match[1]), count);
  }
  return scheduled;
}

/** Text under the picture of the plan: how many blocks the coming epoch holds for the pool. */
export function planCaption(ticker: string, facts: PoolEpochFacts, scheduled: number, siteUrl: string) {
  const lines = [`[${ticker}] is scheduled for ${plural(scheduled, "block")} in epoch ${facts.epoch}.`];
  const percent = luck(scheduled, facts.expectedBlocks);
  if (facts.expectedBlocks != null && percent != null) {
    lines.push(`Its stake lets expect ${formatExpected(facts.expectedBlocks)}, so the epoch ${percent >= 100 ? "is a lucky one" : "falls short of the average"} with ${percent} %.`);
  }
  lines.push("", `${siteUrl}/pool`);
  return lines.join("\n");
}

/** Text under the picture of the result: what the pool made of the epoch that just ended. */
export function resultCaption(ticker: string, facts: PoolEpochFacts, scheduled: number | undefined, siteUrl: string) {
  const made = scheduled != null ? `${facts.blocks} of ${plural(scheduled, "scheduled block")}` : plural(facts.blocks, "block");
  const lines = [`[${ticker}] made ${made} in epoch ${facts.epoch}.`];
  const percent = luck(facts.blocks, facts.expectedBlocks);
  if (facts.expectedBlocks != null && percent != null) lines.push(`Its stake let expect ${formatExpected(facts.expectedBlocks)}, that is ${percent} % of the average.`);
  if (facts.blocks > 0) lines.push("The rewards of the epoch reach the delegators in two epochs.");
  lines.push("", `${siteUrl}/pool`);
  return lines.join("\n");
}

export interface PoolPostState {
  /** Last epoch whose plan and whose result have been dealt with */
  plan: number;
  result: number;
}

/** A first start posts nothing about the past: the next plan and the next result are the first. */
export const initialPoolPostState = (currentEpoch: number): PoolPostState => ({ plan: currentEpoch, result: currentEpoch - 1 });

/**
 * What is due now. A plan is due when the leaderlog of the next epoch is there, a result when the chain data has
 * reached the epoch after it. An epoch without a scheduled block gets no plan post, it is only ticked off.
 */
export function duePoolPosts(state: PoolPostState, currentEpoch: number, chainEpoch: number, scheduled: Map<number, number>) {
  const due: { kind: PoolPostKind; epoch: number; post: boolean }[] = [];
  const finished = Math.min(currentEpoch, chainEpoch) - 1;
  if (finished > state.result) due.push({ kind: "result", epoch: finished, post: true });
  const next = currentEpoch + 1;
  const planned = scheduled.get(next);
  if (next > state.plan && planned != null) due.push({ kind: "plan", epoch: next, post: planned > 0 });
  return due;
}
