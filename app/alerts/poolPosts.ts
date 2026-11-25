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

/** Blocks of an epoch that went to another pool: in the same slot or at the same height. */
export interface LostBattle {
  kind: "slot" | "height";
  /** Ticker of the pool that won, or the start of its id when it has no ticker */
  winner: string;
  count: number;
}

/** How the scheduled blocks of a finished epoch went, as the leaderlog job found out. */
export interface EpochBattles {
  lost: LostBattle[];
  /** Blocks the node did not make at all */
  missed: number;
}

/** Labels of a metric line, e.g. {epoch: "669", kind: "slot"}. */
function labelsOf(text: string) {
  const labels: Record<string, string> = {};
  for (const match of text.matchAll(/(\w+)="((?:[^"\\]|\\.)*)"/g)) labels[match[1]] = match[2].replace(/\\(.)/g, "$1");
  return labels;
}

/**
 * The battles per finished epoch as the leaderlog job publishes them. An epoch is in the map once the job has looked
 * at it, with no lost battle and nothing missed when all went well.
 */
export function battlesByEpoch(pushgatewayMetrics: string): Map<number, EpochBattles> {
  const battles = new Map<number, EpochBattles>();
  const of = (epoch: number) => battles.get(epoch) ?? battles.set(epoch, { lost: [], missed: 0 }).get(epoch)!;
  for (const line of pushgatewayMetrics.split("\n")) {
    const match = /^(cardano_leaderlog_(?:battles_evaluated|missed_blocks|lost_battles))\{([^}]*)\}\s+(\S+)/.exec(line);
    if (!match) continue;
    const labels = labelsOf(match[2]);
    const epoch = Number(labels.epoch);
    const count = Number(match[3]);
    if (!Number.isInteger(epoch) || !Number.isInteger(count) || count < 0) continue;
    if (match[1] === "cardano_leaderlog_battles_evaluated") of(epoch);
    else if (match[1] === "cardano_leaderlog_missed_blocks") of(epoch).missed = count;
    else if ((labels.kind === "slot" || labels.kind === "height") && labels.winner && count > 0) of(epoch).lost.push({ kind: labels.kind, winner: labels.winner, count });
  }
  return battles;
}

/** A pool as the posts name it: its ticker in brackets, a pool without ticker by the start of its id. */
export const poolName = (winner: string) => (winner.startsWith("pool1") ? winner : `[${winner}]`);

const joined = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/** The short line under the blocks in the picture, e.g. "lost to [CF3]". Empty when all went well. */
export function battleNote(battles: EpochBattles | undefined) {
  if (!battles) return "";
  const winners = [...new Set(battles.lost.map((battle) => poolName(battle.winner)))];
  return [winners.length > 0 ? `lost to ${winners.join(", ")}` : "", battles.missed > 0 ? `${battles.missed} missed` : ""].filter(Boolean).join(" · ");
}

/** Grumbling about the pool that took a block. The epoch picks one, so picture and text of a post agree. */
const GRUMBLES = [
  (name: string) => `${name}, we will remember this.`,
  (name: string) => `The torches are lit. ${name}, watch your slots.`,
  (name: string) => `The village has been told about ${name}.`,
  (name: string) => `${name} owes us a block. And an apology.`,
  (name: string) => `Pitchforks are being sharpened in the direction of ${name}.`,
];

export const grumble = (epoch: number, winners: string[]) => `🔥🔱 ${GRUMBLES[epoch % GRUMBLES.length](joined(winners))}`;

const countWord = (count: number) => (count === 1 ? "One block" : `${count} blocks`);

/** Sentences about the blocks that did not make it, for the text under the result. */
export function battleLines(epoch: number, battles: EpochBattles | undefined) {
  if (!battles) return [];
  const lines: string[] = [];
  for (const kind of ["slot", "height"] as const) {
    const lost = battles.lost.filter((battle) => battle.kind === kind);
    if (lost.length === 0) continue;
    const count = lost.reduce((sum, battle) => sum + battle.count, 0);
    const winners = joined([...new Set(lost.map((battle) => poolName(battle.winner)))]);
    lines.push(
      kind === "slot"
        ? `${countWord(count)} went to ${winners} in a slot battle: both pools were leader in the same slot and the draw favoured them.`
        : `${countWord(count)} went to ${winners} in a height battle: their block reached the network first.`
    );
  }
  if (battles.missed > 0) lines.push(`${countWord(battles.missed)} ${battles.missed === 1 ? "was" : "were"} missed by our node.`);
  const winners = [...new Set(battles.lost.map((battle) => poolName(battle.winner)))];
  if (winners.length > 0) lines.push(grumble(epoch, winners));
  return lines;
}

/** Numbers around one epoch of the pool, as the chain data API reports them. Amounts in lovelace. */
export interface EpochNumbers {
  epoch: number;
  blocks: number;
  transactions: number;
  lovelaceMoved: number;
  fees: number;
  largestTransaction?: number | null;
  blockFill?: number | null;
  lastBlockNo?: number | null;
  tokenOutputs: number;
  scriptRuns: number;
  tokensMinted: number;
  networkBlocks: number;
  registeredEpoch?: number | null;
  lifetimeBlocks: number;
  epochsWithBlocks: number;
  blockStreak: number;
  previousStake: number;
  previousDelegators: number;
  stakeRank?: number | null;
  rankedPools: number;
  delegatorRewards: number;
}

/** One little fact for the picture and the text: a heading, a short value, a line under it and a sentence. */
export interface FunFact {
  label: string;
  value: string;
  note: string;
  sentence: string;
}

const EPOCH_DAYS = 5;
const count = (value: number) => value.toLocaleString("en-US");
/** ADA in few characters: 574K, 1.2M, 3.73 */
export const shortAda = (lovelace: number) => {
  const ada = lovelace / 1_000_000;
  if (Math.abs(ada) < 1000) return ada.toLocaleString("en-US", { maximumFractionDigits: Math.abs(ada) < 10 ? 2 : 0 });
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(ada);
};
const signed = (text: string, value: number) => (value > 0 ? `+${text}` : value < 0 ? text : `±${text}`);
const inOurBlocks = (numbers: EpochNumbers) => (numbers.blocks === 1 ? "in our block" : `in our ${numbers.blocks} blocks`);

type FactMaker = (numbers: EpochNumbers, stake: number, delegators: number) => FunFact | null;

/**
 * Twenty facts; an epoch shows one of them, the next epoch the next one. A fact that has nothing to say about the
 * epoch (no block, no change) gives way to the following one. The first eight need a block of the pool.
 */
export const FUN_FACTS: FactMaker[] = [
  (n) => (n.blocks > 0 ? { label: "TRANSACTIONS", value: count(n.transactions), note: inOurBlocks(n), sentence: `Fun fact: ${inOurBlocks(n).replace("in our", "Our")} carried ${count(n.transactions)} transactions.` } : null),
  (n) => (n.blocks > 0 && n.lovelaceMoved > 0 ? { label: "ADA MOVED", value: shortAda(n.lovelaceMoved), note: `ADA ${inOurBlocks(n)}`, sentence: `Fun fact: ${shortAda(n.lovelaceMoved)} ADA changed hands ${inOurBlocks(n)}.` } : null),
  (n) => (n.blocks > 0 && n.fees > 0 ? { label: "FEES", value: shortAda(n.fees), note: `ADA ${inOurBlocks(n)}`, sentence: `Fun fact: the transactions ${inOurBlocks(n)} paid ${shortAda(n.fees)} ADA in fees, they go to the rewards of all stakers.` } : null),
  (n) => (n.largestTransaction ? { label: "LARGEST TRANSFER", value: shortAda(n.largestTransaction), note: "ADA in one transaction", sentence: `Fun fact: the largest transaction ${inOurBlocks(n)} moved ${shortAda(n.largestTransaction)} ADA at once.` } : null),
  (n) => (n.blockFill != null && n.blockFill >= 0.01 && n.blocks > 0 ? { label: "BLOCK FILL", value: `${Math.round(n.blockFill * 100)} %`, note: "of the size limit", sentence: `Fun fact: ${n.blocks === 1 ? "our block was" : "our blocks were"} ${Math.round(n.blockFill * 100)} % full.` } : null),
  (n) => (n.tokenOutputs > 0 ? { label: "TOKEN OUTPUTS", value: count(n.tokenOutputs), note: `with native tokens`, sentence: `Fun fact: ${count(n.tokenOutputs)} outputs ${inOurBlocks(n)} carried native tokens.` } : null),
  (n) => (n.scriptRuns > 0 ? { label: "SMART CONTRACTS", value: count(n.scriptRuns), note: `runs ${inOurBlocks(n)}`, sentence: `Fun fact: smart contracts ran ${count(n.scriptRuns)} times ${inOurBlocks(n)}.` } : null),
  (n) => (n.tokensMinted > 0 ? { label: "TOKENS MINTED", value: count(n.tokensMinted), note: `born ${inOurBlocks(n)}`, sentence: `Fun fact: ${count(n.tokensMinted)} new ${n.tokensMinted === 1 ? "token was" : "tokens were"} minted ${inOurBlocks(n)}.` } : null),
  (n) => (n.lifetimeBlocks > 0 ? { label: "LIFETIME BLOCKS", value: count(n.lifetimeBlocks), note: n.registeredEpoch != null ? `since epoch ${n.registeredEpoch}` : "so far", sentence: `Fun fact: that makes ${count(n.lifetimeBlocks)} blocks in the life of the pool.` } : null),
  (n) => (n.lastBlockNo ? { label: "BLOCK HEIGHT", value: `#${count(n.lastBlockNo)}`, note: "our latest block", sentence: `Fun fact: our latest block is number ${count(n.lastBlockNo)} of the Cardano chain.` } : null),
  (n) => (n.registeredEpoch != null && n.epoch > n.registeredEpoch ? { label: "POOL AGE", value: count((n.epoch - n.registeredEpoch) * EPOCH_DAYS), note: `days, since epoch ${n.registeredEpoch}`, sentence: `Fun fact: the pool has been making blocks for ${count((n.epoch - n.registeredEpoch) * EPOCH_DAYS)} days.` } : null),
  (n) => (n.blockStreak >= 2 ? { label: "BLOCK STREAK", value: count(n.blockStreak), note: "epochs in a row", sentence: `Fun fact: ${n.blockStreak} epochs in a row with a block.` } : null),
  (n) => (n.registeredEpoch != null && n.epochsWithBlocks > 0 ? { label: "EPOCHS WITH A BLOCK", value: count(n.epochsWithBlocks), note: `of ${count(n.epoch - n.registeredEpoch + 1)} epochs`, sentence: `Fun fact: the pool made blocks in ${count(n.epochsWithBlocks)} of its ${count(n.epoch - n.registeredEpoch + 1)} epochs.` } : null),
  (n, _stake, delegators) => (n.previousDelegators > 0 && delegators !== n.previousDelegators ? { label: "NEW DELEGATORS", value: signed(count(delegators - n.previousDelegators), delegators - n.previousDelegators), note: `now ${count(delegators)}`, sentence: `Fun fact: ${delegators > n.previousDelegators ? `${delegators - n.previousDelegators} more` : `${n.previousDelegators - delegators} fewer`} delegators than the epoch before, ${count(delegators)} in all.` } : null),
  (n, stake) => (n.previousStake > 0 && Math.abs(stake - n.previousStake) >= 1_000_000 ? { label: "STAKE CHANGE", value: signed(shortAda(stake - n.previousStake), stake - n.previousStake), note: "ADA since last epoch", sentence: `Fun fact: the stake ${stake > n.previousStake ? "grew" : "shrank"} by ${shortAda(Math.abs(stake - n.previousStake))} ADA since the epoch before.` } : null),
  (_n, stake, delegators) => (delegators > 0 ? { label: "AVERAGE DELEGATION", value: shortAda(stake / delegators), note: "ADA per delegator", sentence: `Fun fact: our delegators stake ${shortAda(stake / delegators)} ADA on average, small and large are equally welcome.` } : null),
  (n) => (n.stakeRank != null && n.rankedPools > 0 ? { label: "STAKE RANK", value: `#${count(n.stakeRank)}`, note: `of ${count(n.rankedPools)} pools`, sentence: `Fun fact: by stake the pool is number ${count(n.stakeRank)} of ${count(n.rankedPools)} pools.` } : null),
  (n) => (n.blocks > 0 && n.networkBlocks > 0 ? { label: "SHARE OF BLOCKS", value: `1 in ${count(Math.round(n.networkBlocks / n.blocks))}`, note: `of ${count(n.networkBlocks)} blocks`, sentence: `Fun fact: ${n.blocks === 1 ? "one" : count(n.blocks)} of the ${count(n.networkBlocks)} blocks of the epoch ${n.blocks === 1 ? "was" : "were"} ours.` } : null),
  (n) => (n.delegatorRewards > 0 ? { label: "PAID TO DELEGATORS", value: shortAda(n.delegatorRewards), note: "ADA in rewards so far", sentence: `Fun fact: the pool has paid its delegators ${shortAda(n.delegatorRewards)} ADA in rewards so far.` } : null),
  (n) => (n.transactions > 0 ? { label: "AVERAGE TRANSACTION", value: shortAda(n.lovelaceMoved / n.transactions), note: `ADA ${inOurBlocks(n)}`, sentence: `Fun fact: a transaction ${inOurBlocks(n)} moved ${shortAda(n.lovelaceMoved / n.transactions)} ADA on average.` } : null),
];

/** The fact of an epoch: the epoch picks where to start, a fact without anything to say passes on to the next. */
export function funFact(numbers: EpochNumbers | null | undefined, stake: number, delegators: number, epoch = numbers?.epoch ?? 0): FunFact | null {
  if (!numbers) return null;
  for (let step = 0; step < FUN_FACTS.length; step++) {
    const fact = FUN_FACTS[(epoch + step) % FUN_FACTS.length](numbers, stake, delegators);
    if (fact) return fact;
  }
  return null;
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
export function resultCaption(ticker: string, facts: PoolEpochFacts, scheduled: number | undefined, siteUrl: string, battles?: EpochBattles, fact?: FunFact | null) {
  const made = scheduled != null ? `${facts.blocks} of ${plural(scheduled, "scheduled block")}` : plural(facts.blocks, "block");
  const lines = [`[${ticker}] forged ${made} in epoch ${facts.epoch}.`, ...battleLines(facts.epoch, battles)];
  const percent = luck(facts.blocks, facts.expectedBlocks);
  if (facts.expectedBlocks != null && percent != null) lines.push(`Its stake let expect ${formatExpected(facts.expectedBlocks)}, that is ${percent} % of the average.`);
  if (facts.blocks > 0) lines.push("The rewards of the epoch reach the delegators in two epochs.");
  if (fact) lines.push(fact.sentence);
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
