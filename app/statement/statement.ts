/** Pure helpers for the wallet statement: running balance, price lookup and CSV. */

export interface StatementInput {
  timestamp: string;
  epoch: number;
  txHash?: string | null;
  change: number;
  operations: string[];
}

export interface StatementLine extends StatementInput {
  /** Balance in lovelace after this row */
  balance: number;
  /** Price of one ADA at the time, if known */
  price?: number;
  /** Value of the change at the time */
  fiat?: number;
}

/** Price valid at `unixSeconds`: the latest price point at or before it. `prices` is ascending. */
export function priceAt(prices: [number, number][], unixSeconds: number) {
  let low = 0;
  let high = prices.length - 1;
  let found: number | undefined;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (prices[mid][0] <= unixSeconds) {
      found = prices[mid][1];
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

/** Adds running balance and fiat values. `rows` are oldest first, the result is newest first. */
export function statementLines(rows: StatementInput[], prices: [number, number][]): StatementLine[] {
  let balance = 0;
  const lines = rows.map((row) => {
    balance += row.change;
    const price = priceAt(prices, Date.parse(row.timestamp) / 1000);
    return { ...row, balance, price, fiat: price == null ? undefined : (price * row.change) / 1_000_000 };
  });
  return lines.reverse();
}

const csvCell = (value: string | number | undefined | null) => {
  const text = value == null ? "" : String(value);
  return /[",\n;]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const ada = (lovelace: number) => (lovelace / 1_000_000).toFixed(6);

export function statementCsv(lines: StatementLine[], currency: string) {
  const header = ["Timestamp", "Epoch", "TxHash", "Change ADA", `Price ${currency}`, `Change ${currency}`, "Balance ADA", "Operations"];
  const rows = lines.map((line) => [
    line.timestamp,
    line.epoch,
    line.txHash,
    ada(line.change),
    line.price?.toFixed(6),
    line.fiat?.toFixed(2),
    ada(line.balance),
    line.operations.join(" "),
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}
