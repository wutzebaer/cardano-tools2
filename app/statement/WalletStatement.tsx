"use client";

import { explorerTxUrl } from "@cardano/network";
import { formatAda, shortenId } from "@cardano/utils";
import { ExternalLink, Field, Notice, secondaryButtonClass, textareaClass } from "@components/ui";
import { useHandle } from "@components/useHandles";
import { useWallet } from "@components/useWallet";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Currency, loadPrices, loadStatement, PricePoint, StatementRow } from "./loadStatement";
import { statementCsv, statementLines } from "./statement";

const STORAGE_KEY = "statementAddresses";
const VISIBLE_ROWS = 500;

const subscribeNothing = () => () => {};

const OPERATION_LABELS: Record<string, string> = {
  IN: "received",
  OUT: "sent",
  WITHDRAW: "reward withdrawal",
  REWARD_member: "staking reward",
  REWARD_leader: "pool operator reward",
  REWARD_refund: "deposit refund",
  REWARD_reserves: "reserves payout",
  REWARD_treasury: "treasury payout",
};

function formatFiat(value: number | undefined, currency: Currency) {
  return value == null ? "" : Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

function formatTimestamp(timestamp: string) {
  return new Date(timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function download(filename: string, content: string) {
  // the BOM makes spreadsheet apps read the file as UTF-8
  const url = URL.createObjectURL(new Blob(["﻿", content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function WalletStatement() {
  const { wallet, connect } = useWallet();
  // addresses of the last statement are remembered; null means the user has not typed yet
  const [typed, setInput] = useState<string | null>(null);
  const stored = useSyncExternalStore(subscribeNothing, () => localStorage.getItem(STORAGE_KEY) ?? "", () => "");
  // until something is typed the field holds the addresses of the last statement or the connected wallet
  const walletHandle = useHandle(wallet?.stakeAddress);
  const input = typed ?? (stored || walletHandle || wallet?.stakeAddress || "");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [rows, setRows] = useState<StatementRow[] | null>(null);
  const [prices, setPrices] = useState<Partial<Record<Currency, PricePoint[]>>>({});
  const [priceError, setPriceError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const addresses = useMemo(() => [...new Set((input.trim() || walletHandle || wallet?.stakeAddress || "").split(/[\s,;]+/).filter(Boolean))], [input, wallet, walletHandle]);

  const ensurePrices = async (wanted: Currency) => {
    if (prices[wanted]) return;
    try {
      const loaded = await loadPrices(wanted);
      setPrices((current) => ({ ...current, [wanted]: loaded }));
      setPriceError("");
    } catch (error) {
      // the statement itself is still useful without fiat values
      setPriceError(error instanceof Error ? error.message : String(error));
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      localStorage.setItem(STORAGE_KEY, input.trim());
      const [statement] = await Promise.all([loadStatement(addresses), ensurePrices(currency)]);
      setRows(statement);
      setShowAll(false);
    } finally {
      setLoading(false);
    }
  };

  // a connected wallet gets its statement without a click; whoever wants another address clears the field and types it
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (autoLoaded.current || !wallet || typed !== null || rows) return;
    autoLoaded.current = true;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the wallet arrives
  }, [wallet]);

  const changeCurrency = (next: Currency) => {
    setCurrency(next);
    if (rows) ensurePrices(next);
  };

  const lines = useMemo(() => (rows ? statementLines(rows, prices[currency] ?? []) : []), [rows, prices, currency]);
  const visible = showAll ? lines : lines.slice(0, VISIBLE_ROWS);
  const missingPrices = lines.some((line) => line.price == null);

  return (
    <div className="flex flex-col gap-6">
      <div className="surface flex flex-col gap-4 p-5">
        <Field label="Stake addresses, payment addresses or $handles, one per line" hint="Stake addresses include staking rewards. Several addresses are merged into one statement.">
          <textarea
            className={`${textareaClass} font-mono text-xs`}
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={walletHandle || wallet?.stakeAddress || "stake1…"}
          />
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn btn-primary btn-sm" onClick={load} disabled={addresses.length === 0 || loading}>
            {loading ? <span className="loading loading-spinner loading-xs" /> : null}
            Create statement
          </button>
          {!wallet && !input.trim() ? (
            <button className={secondaryButtonClass} onClick={connect}>
              Use my wallet
            </button>
          ) : null}
          <select className="select select-sm w-24 border-line bg-base-300" value={currency} onChange={(e) => changeCurrency(e.target.value as Currency)} aria-label="Currency">
            <option>EUR</option>
            <option>USD</option>
          </select>
          {lines.length > 0 ? (
            <button className={`${secondaryButtonClass} ml-auto`} onClick={() => download(`cardano-statement-${currency}.csv`, statementCsv(lines, currency))}>
              <ArrowDownTrayIcon className="size-4" />
              Export CSV
            </button>
          ) : null}
        </div>
      </div>

      {priceError ? <Notice tone="warning">No {currency} values: {priceError}</Notice> : null}
      {rows && !priceError && missingPrices ? <Notice>There are no prices before the end of September 2018, older rows have no {currency} value.</Notice> : null}

      {rows && lines.length === 0 ? <div className="surface px-6 py-16 text-center text-sm text-base-content/55">No transactions found.</div> : null}

      {lines.length > 0 ? (
        <div className="surface overflow-x-auto p-2">
          <table className="table table-sm">
            <thead>
              <tr className="text-xs text-base-content/55">
                <th>Time</th>
                <th className="text-right">Epoch</th>
                <th>Transaction</th>
                <th className="text-right">Change</th>
                <th className="text-right">{currency}</th>
                <th className="text-right">Balance</th>
                <th>Operations</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((line, index) => (
                <tr key={`${line.timestamp}-${line.txHash}-${index}`}>
                  <td className="whitespace-nowrap">{formatTimestamp(line.timestamp)}</td>
                  <td className="text-right tabular-nums">{line.epoch}</td>
                  <td className="whitespace-nowrap font-mono text-xs">
                    {line.txHash ? (
                      <ExternalLink href={explorerTxUrl(line.txHash)} className="inline-flex items-center gap-1 hover:text-primary">
                        {shortenId(line.txHash, 8)}
                      </ExternalLink>
                    ) : null}
                  </td>
                  <td className={`whitespace-nowrap text-right tabular-nums ${line.change < 0 ? "text-error" : "text-success"}`}>{formatAda(line.change)}</td>
                  <td className="whitespace-nowrap text-right tabular-nums text-base-content/65" title={line.price == null ? undefined : `1 ₳ = ${line.price} ${currency}`}>
                    {formatFiat(line.fiat, currency)}
                  </td>
                  <td className="whitespace-nowrap text-right tabular-nums">{formatAda(line.balance)}</td>
                  <td className="text-xs text-base-content/65">{line.operations.map((operation) => OPERATION_LABELS[operation] ?? operation).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {lines.length > visible.length ? (
            <div className="p-3">
              <button className={secondaryButtonClass} onClick={() => setShowAll(true)}>
                Show all {lines.length} rows
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-base-content/45">
        Prices are Kraken closing prices: daily for the last two years, weekly before that. Staking rewards are listed at the start of the epoch they were earned in.
      </p>
    </div>
  );
}
