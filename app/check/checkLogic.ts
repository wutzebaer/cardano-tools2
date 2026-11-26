/**
 * What the staking check concludes from the chain data of an address and its pool.
 * No wallet, no network: the page and the tests feed it the answers of the chain data API.
 */

export interface PoolFacts {
  poolHash: string;
  ticker?: string | null;
  name?: string | null;
  homepage?: string | null;
  /** 0.01 is 1 % */
  margin: number;
  /** Lovelace per epoch */
  fixedCost: number;
  pledge: number;
  nextMargin?: number | null;
  nextFixedCost?: number | null;
  retiringEpoch?: number | null;
  /** Lovelace */
  activeStake: number;
  delegators: number;
  saturationStake: number;
}

export interface PoolResults {
  fromEpoch: number;
  toEpoch: number;
  /** Percent per year, null if the pool paid nothing in these epochs */
  roa?: number | null;
  networkRoa: number;
  blocks: { epoch: number; blocks: number }[];
  lifetimeBlocks: number;
}

export type Level = "ok" | "info" | "warning" | "problem";

export interface Finding {
  level: Level;
  title: string;
  text: string;
}

export const EPOCH_DAYS = 5;

/** Above this margin a pool keeps a noticeable part of the rewards. */
export const HIGH_MARGIN = 0.05;

/** A pool this far below the network's return is worth a second look, whatever the reason. */
export const LOW_RETURN_RATIO = 0.7;

/** From about this stake on a pool is expected to make a block in most epochs. */
export const REGULAR_BLOCKS_STAKE = 1_000_000_000_000;

const percent = (share: number) => `${Number((share * 100).toFixed(2))} %`;

const ada = (lovelace: number) => `${Math.round(lovelace / 1_000_000).toLocaleString("en-US")} ₳`;

export const saturation = (pool: Pick<PoolFacts, "activeStake" | "saturationStake">) => (pool.saturationStake > 0 ? pool.activeStake / pool.saturationStake : 0);

export const isRetired = (pool: Pick<PoolFacts, "retiringEpoch">, currentEpoch: number) => pool.retiringEpoch != null && pool.retiringEpoch <= currentEpoch;

/** What stands out about a pool, the most serious first. A healthy pool gets exactly one "ok". */
export function poolFindings(pool: PoolFacts, results: PoolResults | null | undefined, currentEpoch: number): Finding[] {
  const findings: Finding[] = [];

  if (isRetired(pool, currentEpoch)) {
    findings.push({
      level: "problem",
      title: "This pool has retired",
      text: `It stopped in epoch ${pool.retiringEpoch}. ADA delegated to it earns no rewards any more, a new delegation takes effect within two epoch boundaries.`,
    });
    // nothing else matters for a pool that is gone
    return findings;
  }
  if (pool.retiringEpoch != null) {
    const epochs = pool.retiringEpoch - currentEpoch;
    findings.push({
      level: "warning",
      title: `This pool retires in epoch ${pool.retiringEpoch}`,
      text: `That is in ${epochs} epoch${epochs === 1 ? "" : "s"}, about ${epochs * EPOCH_DAYS} days. From then on it pays no rewards, so it is time to pick another pool.`,
    });
  }

  const filled = saturation(pool);
  if (filled > 1) {
    findings.push({
      level: "warning",
      title: "This pool is oversaturated",
      text: `It holds ${ada(pool.activeStake)}, ${percent(filled - 1)} more than the ${ada(pool.saturationStake)} a pool is rewarded for. The excess earns nothing, which lowers the return of every delegator.`,
    });
  } else if (filled > 0.95) {
    findings.push({
      level: "info",
      title: "This pool is close to saturation",
      text: `It is ${percent(filled)} full. Above ${ada(pool.saturationStake)} the return of every delegator starts to drop.`,
    });
  }

  if (results) {
    const made = results.blocks.reduce((sum, epoch) => sum + epoch.blocks, 0);
    const epochs = results.blocks.length;
    if (made === 0) {
      findings.push(
        pool.activeStake >= REGULAR_BLOCKS_STAKE
          ? {
              level: "problem",
              title: "This pool makes no blocks",
              text: `It has not made a block in the last ${epochs} epochs, although a pool of its size is expected to make one in most epochs. Without blocks there are no rewards.`,
            }
          : {
              level: "warning",
              title: "No block in the last epochs",
              text: `The pool has not made a block in the last ${epochs} epochs. With ${ada(pool.activeStake)} of stake blocks are rare and a matter of luck, but rewards only come with them.`,
            }
      );
    } else if (results.roa != null && results.networkRoa > 0 && results.roa < results.networkRoa * LOW_RETURN_RATIO && pool.activeStake >= REGULAR_BLOCKS_STAKE) {
      findings.push({
        level: "warning",
        title: "Returns are well below the network",
        text: `Delegators earned ${results.roa.toFixed(2)} % per year over the last ${results.toEpoch - results.fromEpoch + 1} epochs, the network ${results.networkRoa.toFixed(2)} %. Luck plays a part in a span this short, fees and missed blocks do too.`,
      });
    }
  }

  if (pool.margin >= HIGH_MARGIN) {
    findings.push({
      level: "warning",
      title: `The pool keeps ${percent(pool.margin)} of the rewards`,
      text: "That is its margin, taken from the rewards of every epoch before they are shared. Many pools take 0 to 2 %.",
    });
  }
  if (pool.nextMargin != null && pool.nextMargin > pool.margin) {
    findings.push({
      level: "warning",
      title: `The margin rises to ${percent(pool.nextMargin)}`,
      text: `The pool has registered a higher margin than the current ${percent(pool.margin)}. It takes effect at one of the next epoch boundaries.`,
    });
  }
  if (pool.nextFixedCost != null && pool.nextFixedCost > pool.fixedCost) {
    findings.push({
      level: "info",
      title: `The fixed fee rises to ${ada(pool.nextFixedCost)} per epoch`,
      text: `It is ${ada(pool.fixedCost)} now and shared by all delegators of the pool.`,
    });
  }

  if (findings.length === 0) {
    findings.push({ level: "ok", title: "Nothing stands out", text: "The pool is active, not retiring, below saturation and takes moderate fees." });
  }
  const order: Level[] = ["problem", "warning", "info", "ok"];
  return findings.sort((a, b) => order.indexOf(a.level) - order.indexOf(b.level));
}

/** Other pools are worth showing when something about the current one calls for a decision. */
export const suggestsAlternatives = (findings: Finding[]) => findings.some((finding) => finding.level === "problem" || finding.level === "warning");

/**
 * Lovelace per year the margin of a pool costs a delegator, compared with a pool that takes none.
 * The return a delegator sees is what is left after the margin, so the margin's part is r * m / (1 - m).
 */
export function marginCostPerYear(stake: number, margin: number, netRoaPercent: number) {
  if (!(stake > 0) || !(margin > 0) || margin >= 1 || !(netRoaPercent > 0)) return 0;
  return Math.round((stake * (netRoaPercent / 100) * margin) / (1 - margin));
}

export type DrepKind = "none" | "abstain" | "no_confidence" | "drep";

export function drepKind(drepId?: string | null): DrepKind {
  if (!drepId) return "none";
  if (drepId === "drep_always_abstain") return "abstain";
  if (drepId === "drep_always_no_confidence") return "no_confidence";
  return "drep";
}

/** Small deterministic hash, so the same address always sees the same suggestions. */
function seedOf(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

/**
 * Pools to suggest: `always` if it is among the candidates or given itself, and `count - 1` others picked by the seed.
 * The pool the address is delegated to is never suggested.
 */
export function pickAlternatives<T extends { poolHash: string }>(candidates: T[], currentPoolHash: string | null | undefined, always: T | null | undefined, seed: string, count = 3): T[] {
  const picked: T[] = [];
  if (always && always.poolHash !== currentPoolHash) picked.push(always);
  const others = candidates.filter((pool) => pool.poolHash !== currentPoolHash && pool.poolHash !== always?.poolHash);
  let state = seedOf(seed) || 1;
  const pool = [...others];
  while (picked.length < count && pool.length > 0) {
    // xorshift32
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    picked.push(pool.splice(state % pool.length, 1)[0]);
  }
  return picked;
}
