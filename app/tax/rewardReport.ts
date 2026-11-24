/**
 * Staking rewards as income: one entry per epoch with its value on the day it was paid out, and totals per year.
 * Pure, the page and the tests feed it the rows of the wallet statement.
 */

export interface RewardRow {
  /** Start of the epoch the reward was earned in */
  timestamp: string;
  /** Epoch the reward was earned in */
  epoch: number;
  /** Lovelace of rewards in this row */
  rewards: number;
  operations: string[];
}

export interface RewardEntry {
  earnedEpoch: number;
  payoutEpoch: number;
  /** When the reward arrived in the reward account, ISO time */
  payoutTime: string;
  lovelace: number;
  /** A pool operator's reward for running the pool, not a delegator's */
  operator: boolean;
  /** Price of one ADA at the payout, if known */
  price?: number;
  /** Value of the reward at the payout */
  fiat?: number;
}

export interface YearTotal {
  year: number;
  rewards: number;
  lovelace: number;
  /** Sum of the values that are known */
  fiat: number;
  /** Rewards without a price, their value is missing from `fiat` */
  unpriced: number;
}

/** Rewards earned in an epoch are calculated in the next and paid at the boundary after it. */
export const PAYOUT_DELAY_EPOCHS = 2;

/** Rewards for staking. Deposit refunds and payouts from treasury or reserves are not staking income. */
const STAKING_REWARDS = ["REWARD_member", "REWARD_leader"];

/**
 * The staking rewards among the rows of a statement, oldest first, valued at the time of their payout.
 * `priceAt` gives the price of one ADA at a unix time, undefined where there is none.
 */
export function rewardEntries(rows: RewardRow[], priceAt: (unixSeconds: number) => number | undefined, epochSeconds: number): RewardEntry[] {
  return rows
    .filter((row) => row.rewards > 0 && row.operations.some((operation) => STAKING_REWARDS.includes(operation)))
    .map((row) => {
      const payoutUnix = Date.parse(row.timestamp) / 1000 + PAYOUT_DELAY_EPOCHS * epochSeconds;
      const price = priceAt(payoutUnix);
      return {
        earnedEpoch: row.epoch,
        payoutEpoch: row.epoch + PAYOUT_DELAY_EPOCHS,
        payoutTime: new Date(payoutUnix * 1000).toISOString(),
        lovelace: row.rewards,
        operator: row.operations.includes("REWARD_leader"),
        price,
        fiat: price == null ? undefined : (price * row.rewards) / 1_000_000,
      };
    })
    .sort((a, b) => a.payoutEpoch - b.payoutEpoch);
}

/** A reward that is calculated but not paid yet belongs to no year. */
export const isPaid = (entry: RewardEntry, nowUnix: number) => Date.parse(entry.payoutTime) / 1000 <= nowUnix;

/** Totals per calendar year of the payout, in the time zone the code runs in: the reader's own in the browser. Newest year first. */
export function yearTotals(entries: RewardEntry[]): YearTotal[] {
  const years = new Map<number, YearTotal>();
  for (const entry of entries) {
    const year = new Date(entry.payoutTime).getFullYear();
    const total = years.get(year) ?? { year, rewards: 0, lovelace: 0, fiat: 0, unpriced: 0 };
    total.rewards++;
    total.lovelace += entry.lovelace;
    if (entry.fiat == null) total.unpriced++;
    else total.fiat += entry.fiat;
    years.set(year, total);
  }
  return [...years.values()].sort((a, b) => b.year - a.year);
}

export interface MonthTotal {
  /** `YYYY-MM` of the payout, local time */
  month: string;
  rewards: number;
  lovelace: number;
  fiat: number;
  unpriced: number;
}

/**
 * Totals per calendar month of one year, January first. Months without a payout are listed with zeros between the
 * first and the last month that has one, so a monthly return has a line for each of them.
 */
export function monthTotals(entries: RewardEntry[], year: number): MonthTotal[] {
  const months = new Map<number, MonthTotal>();
  for (const entry of entries) {
    const date = new Date(entry.payoutTime);
    if (date.getFullYear() !== year) continue;
    const index = date.getMonth();
    const total = months.get(index) ?? { month: `${year}-${`${index + 1}`.padStart(2, "0")}`, rewards: 0, lovelace: 0, fiat: 0, unpriced: 0 };
    total.rewards++;
    total.lovelace += entry.lovelace;
    if (entry.fiat == null) total.unpriced++;
    else total.fiat += entry.fiat;
    months.set(index, total);
  }
  if (months.size === 0) return [];
  const totals: MonthTotal[] = [];
  for (let index = Math.min(...months.keys()); index <= Math.max(...months.keys()); index++) {
    totals.push(months.get(index) ?? { month: `${year}-${`${index + 1}`.padStart(2, "0")}`, rewards: 0, lovelace: 0, fiat: 0, unpriced: 0 });
  }
  return totals;
}

export function monthCsv(totals: MonthTotal[], currency: string) {
  const header = ["Month", "Payouts", "Rewards ADA", `Value ${currency}`, "Payouts without a price"];
  const rows = totals.map((total) => [total.month, total.rewards, (total.lovelace / 1_000_000).toFixed(6), total.fiat.toFixed(2), total.unpriced]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

const csvCell =(value: string | number | undefined | null) => {
  const text = value == null ? "" : String(value);
  return /[",\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** `YYYY-MM-DD` in local time, the day the report shows as well */
const localDay = (date: Date) => `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;

export function rewardCsv(entries: RewardEntry[], currency: string) {
  const header = ["Payout date", "Payout epoch", "Earned in epoch", "Kind", "Reward ADA", `Price ${currency}`, `Value ${currency}`];
  const rows = entries.map((entry) => [
    localDay(new Date(entry.payoutTime)),
    entry.payoutEpoch,
    entry.earnedEpoch,
    entry.operator ? "pool operator reward" : "staking reward",
    (entry.lovelace / 1_000_000).toFixed(6),
    entry.price?.toFixed(6),
    entry.fiat?.toFixed(2),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
