"use client";

import { answered } from "@cardano/answer";
import { NETWORK } from "@cardano/network";
import { formatAda } from "@cardano/utils";
import { Field, Notice, secondaryButtonClass, textareaClass } from "@components/ui";
import { useHandle } from "@components/useHandles";
import { useWallet } from "@components/useWallet";
import { ArrowDownTrayIcon, PrinterIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState } from "react";
import { Currency, loadPrices, loadStatement, PricePoint, StatementRow } from "../statement/loadStatement";
import { priceAt } from "../statement/statement";
import { isPaid, monthCsv, monthTotals, rewardCsv, rewardEntries, yearTotals } from "./rewardReport";

function formatFiat(value: number | undefined, currency: Currency) {
  return value == null ? "" : Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

const formatDay = (isoTime: string) => new Date(isoTime).toLocaleDateString(undefined, { dateStyle: "medium" });

/** "March 2026" for `2026-03` */
const formatMonth = (month: string) => new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

function download(filename: string, content: string) {
  // the BOM makes spreadsheet apps read the file as UTF-8
  const url = URL.createObjectURL(new Blob(["﻿", content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function TaxReport() {
  const { wallet } = useWallet();
  // null until something is typed: the field then holds the connected wallet
  const [typed, setInput] = useState<string | null>(null);
  const walletHandle = useHandle(wallet?.stakeAddress);
  const input = typed ?? (walletHandle || wallet?.stakeAddress || "");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [loaded, setLoaded] = useState<{ rows: StatementRow[]; addresses: string[]; at: number } | null>(null);
  const [prices, setPrices] = useState<Partial<Record<Currency, PricePoint[]>>>({});
  const [priceError, setPriceError] = useState("");
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState<number | null>(null);

  const addresses = useMemo(() => [...new Set(input.split(/[\s,;]+/).filter(Boolean))], [input]);

  const ensurePrices = async (wanted: Currency) => {
    if (prices[wanted]) return;
    try {
      const fetched = await answered(loadPrices(wanted));
      setPrices((current) => ({ ...current, [wanted]: fetched }));
      setPriceError("");
    } catch (error) {
      // the rewards themselves are still worth listing without their values
      setPriceError(error instanceof Error ? error.message : String(error));
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [rows] = await Promise.all([answered(loadStatement(addresses)), ensurePrices(currency)]);
      setLoaded({ rows, addresses, at: Date.now() / 1000 });
      setYear(null);
    } finally {
      setLoading(false);
    }
  };

  // a connected wallet gets its report without a click; whoever wants another address clears the field and types it
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (autoLoaded.current || !wallet || typed !== null || loaded) return;
    autoLoaded.current = true;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the wallet arrives
  }, [wallet]);

  const changeCurrency = (next: Currency) => {
    setCurrency(next);
    if (loaded) ensurePrices(next);
  };

  const entries = useMemo(() => {
    if (!loaded) return [];
    const points = prices[currency] ?? [];
    // rewards that are calculated but not paid out yet belong to no year
    return rewardEntries(loaded.rows, (unix) => priceAt(points, unix), NETWORK.epochSeconds).filter((entry) => isPaid(entry, loaded.at));
  }, [loaded, prices, currency]);
  const totals = useMemo(() => yearTotals(entries), [entries]);
  const shownYear = year ?? totals[0]?.year;
  const shown = entries.filter((entry) => new Date(entry.payoutTime).getFullYear() === shownYear).reverse();
  const shownTotal = totals.find((total) => total.year === shownYear);
  const months = useMemo(() => (shownYear == null ? [] : monthTotals(entries, shownYear)), [entries, shownYear]);

  return (
    <div className="flex flex-col gap-6">
      <div className="surface flex flex-col gap-4 p-5 print:hidden">
        <Field label="Stake addresses or $handles, one per line" hint="Rewards belong to stake addresses. Several addresses are merged into one report.">
          <textarea className={`${textareaClass} font-mono text-xs`} rows={2} value={input} onChange={(e) => setInput(e.target.value)} placeholder="stake1…" />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary btn-sm" onClick={load} disabled={addresses.length === 0 || loading}>
            {loading ? <span className="loading loading-spinner loading-xs" /> : null}
            Create report
          </button>
          <select className="select select-sm w-24 border-line bg-base-300" value={currency} onChange={(e) => changeCurrency(e.target.value as Currency)} aria-label="Currency">
            <option>EUR</option>
            <option>USD</option>
          </select>
          {entries.length > 0 ? (
            <div className="ml-auto flex gap-2">
              <button className={secondaryButtonClass} onClick={() => download(`cardano-staking-rewards-${shownYear}-${currency}.csv`, rewardCsv([...shown].reverse(), currency))}>
                <ArrowDownTrayIcon className="size-4" />
                CSV {shownYear}
              </button>
              <button className={secondaryButtonClass} onClick={() => download(`cardano-staking-rewards-${shownYear}-by-month-${currency}.csv`, monthCsv(months, currency))}>
                <ArrowDownTrayIcon className="size-4" />
                CSV months {shownYear}
              </button>
              <button className={secondaryButtonClass} onClick={() => download(`cardano-staking-rewards-all-${currency}.csv`, rewardCsv(entries, currency))}>
                <ArrowDownTrayIcon className="size-4" />
                CSV all years
              </button>
              <button className={secondaryButtonClass} onClick={() => window.print()}>
                <PrinterIcon className="size-4" />
                Print or save as PDF
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {priceError ? <Notice tone="warning">No {currency} values: {priceError}</Notice> : null}
      {loaded && entries.length === 0 ? <div className="surface px-6 py-16 text-center text-sm text-base-content/55">No staking rewards found for these addresses.</div> : null}

      {totals.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
          {totals.map((total) => (
            <li key={total.year}>
              <button
                className={`surface w-full p-4 text-left transition-colors hover:border-line-strong ${total.year === shownYear ? "border-primary/60" : ""}`}
                onClick={() => setYear(total.year)}
                aria-pressed={total.year === shownYear}
              >
                <p className="section-label">{total.year}</p>
                <p className="text-brand mt-1 text-xl font-semibold tracking-tight">{formatFiat(total.fiat, currency)}</p>
                <p className="text-xs text-base-content/55">
                  {formatAda(total.lovelace)} in {total.rewards} payouts
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {shownTotal ? (
        <div className="surface flex flex-col gap-4 p-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Staking rewards {shownTotal.year}</h2>
            <p className="mt-1 break-all font-mono text-[11px] text-base-content/55">{loaded?.addresses.join(", ")}</p>
          </div>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-base-content/45">Value at payout</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatFiat(shownTotal.fiat, currency)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-base-content/45">Rewards</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatAda(shownTotal.lovelace)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-base-content/45">Payouts</dt>
              <dd className="text-lg font-semibold tabular-nums">{shownTotal.rewards}</dd>
            </div>
          </dl>
          {shownTotal.unpriced > 0 ? (
            <Notice tone="warning">
              {shownTotal.unpriced} payout{shownTotal.unpriced === 1 ? " has" : "s have"} no {currency} price and {shownTotal.unpriced === 1 ? "is" : "are"} missing from the value.
            </Notice>
          ) : null}
          <div className="flex flex-col gap-2">
            <h3 className="section-label">By month</h3>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr className="text-xs text-base-content/55">
                    <th>Month</th>
                    <th className="text-right">Payouts</th>
                    <th className="text-right">Rewards</th>
                    <th className="text-right">Value at payout</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((month) => (
                    <tr key={month.month} className={month.rewards === 0 ? "text-base-content/45" : ""}>
                      <td className="whitespace-nowrap">{formatMonth(month.month)}</td>
                      <td className="text-right tabular-nums">{month.rewards}</td>
                      <td className="whitespace-nowrap text-right tabular-nums">{formatAda(month.lovelace)}</td>
                      <td className="whitespace-nowrap text-right tabular-nums font-medium">
                        {formatFiat(month.fiat, currency)}
                        {month.unpriced > 0 ? <span className="ml-1 text-xs font-normal text-warning">({month.unpriced} without price)</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <h3 className="section-label">Every payout</h3>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr className="text-xs text-base-content/55">
                  <th>Payout date</th>
                  <th className="text-right">Payout epoch</th>
                  <th className="text-right">Earned in epoch</th>
                  <th className="text-right">Reward</th>
                  <th className="text-right">1 ₳ in {currency}</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((entry) => (
                  <tr key={`${entry.payoutEpoch}-${entry.operator}`}>
                    <td className="whitespace-nowrap">
                      {formatDay(entry.payoutTime)}
                      {entry.operator ? <span className="ml-2 text-xs text-base-content/55">pool operator reward</span> : null}
                    </td>
                    <td className="text-right tabular-nums">{entry.payoutEpoch}</td>
                    <td className="text-right tabular-nums">{entry.earnedEpoch}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{formatAda(entry.lovelace)}</td>
                    <td className="text-right tabular-nums text-base-content/65">{entry.price?.toFixed(4)}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{formatFiat(entry.fiat, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-base-content/45">
        A help for your records, not tax advice. How staking rewards are taxed depends on your country and situation, ask a tax adviser. Rewards count on the day they arrive in
        the reward account, two epochs after they were earned, whether or not they are withdrawn. Prices are Kraken closing prices: daily for the last two years, weekly before
        that, so older values are approximate. Deposit refunds and payouts from the treasury are not listed.
      </p>
    </div>
  );
}
