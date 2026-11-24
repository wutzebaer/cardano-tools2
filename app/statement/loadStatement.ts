"use server";

import { components } from "@cardano/dbsync.schema";
import { getAddressByHandle, getStatement } from "@cardano/dbsync";

export type StatementRow = components["schemas"]["AccountStatementRow"];
export type Currency = "EUR" | "USD";

/** [unix seconds, price of one ADA], ascending */
export type PricePoint = [number, number];

const MAX_ADDRESSES = 20;

/** All transactions and rewards of the given stake or payment addresses or `$handles`, oldest first. */
export async function loadStatement(addresses: string[]): Promise<StatementRow[]> {
  if (addresses.length > MAX_ADDRESSES) {
    throw new Error(`At most ${MAX_ADDRESSES} addresses`);
  }
  const resolved = await Promise.all(
    addresses.map(async (address) => {
      if (!address.startsWith("$")) return address;
      const found = await getAddressByHandle(address.slice(1).toLowerCase()).catch(() => null);
      if (!found?.address) throw new Error(`The handle ${address} was not found`);
      return found.address;
    })
  );
  const statements = await Promise.all([...new Set(resolved)].map((address) => getStatement(address)));
  return statements.flat().sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

async function krakenOhlc(pair: string, intervalMinutes: number): Promise<PricePoint[]> {
  const response = await fetch(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${intervalMinutes}&since=0`, { next: { revalidate: 3600 } });
  if (!response.ok) {
    throw new Error(`Price lookup failed: ${response.status}`);
  }
  const payload = (await response.json()) as { error: string[]; result: Record<string, unknown> };
  if (payload.error.length > 0) {
    throw new Error(`Price lookup failed: ${payload.error.join(", ")}`);
  }
  const candles = Object.entries(payload.result).find(([key]) => key !== "last")?.[1] as [number, string, string, string, string][];
  // candle: [time, open, high, low, close, ...]
  return candles.map(([time, , , , close]) => [time, Number(close)]);
}

/**
 * Historical ADA prices from Kraken's public market data: daily closes for the last two years,
 * weekly closes before that (Kraken serves at most 720 candles per resolution).
 */
export async function loadPrices(currency: Currency): Promise<PricePoint[]> {
  const pair = `ADA${currency}`;
  const [weekly, daily] = await Promise.all([krakenOhlc(pair, 10080), krakenOhlc(pair, 1440)]);
  const firstDaily = daily[0]?.[0] ?? Number.POSITIVE_INFINITY;
  return [...weekly.filter(([time]) => time < firstDaily), ...daily];
}
