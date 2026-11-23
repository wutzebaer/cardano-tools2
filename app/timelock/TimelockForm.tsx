"use client";

import { assetKey, assetsInUtxos, lovelaceInUtxos, WalletAsset } from "@cardano/assets";
import { unixToSlot } from "@cardano/network";
import { findTimelocks, isUnlockable, lockFunds, LockedToken, minLockLovelace, Timelock, timelockAddress, timelockKey, timelockScriptJson, unlockDate, unlockFunds } from "@cardano/timelock";
import { DAY_SECONDS, MAX_LOCK_DAYS, unlockDateError, unlockUnixOfDate } from "@cardano/timelockScript";
import { walletChangeAddress, walletUtxos } from "@cardano/transaction";
import { assetNameFromHex, formatAda, shortenId } from "@cardano/utils";
import ConnectWallet from "@components/ConnectWallet";
import TxResult from "@components/TxResult";
import { Field, inputClass, Notice, secondaryButtonClass } from "@components/ui";
import { ConnectedWallet } from "@components/useWallet";
import { Address } from "@emurgo/cardano-serialization-lib-browser";
import { LockClosedIcon, LockOpenIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";

interface TokenRow {
  key: string;
  amount: string;
}

const isoDate = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10);

const formatDate = (date: Date) => date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

function adaToLovelace(ada: string) {
  const value = Number(ada);
  return ada.trim() !== "" && Number.isFinite(value) && value > 0 ? BigInt(Math.round(value * 1_000_000)) : 0n;
}

function tokenLabel(token: LockedToken) {
  return `${token.quantity} ${assetNameFromHex(token.name) || shortenId(token.policyId)}`;
}

function Timelocks({ wallet }: { wallet: ConnectedWallet }) {
  const [now] = useState(() => Date.now() / 1000);
  const [date, setDate] = useState("");
  const [ada, setAda] = useState("");
  const [tokenRows, setTokenRows] = useState<TokenRow[]>([]);
  const [funds, setFunds] = useState<{ wallet: ConnectedWallet; lovelace: bigint; assets: WalletAsset[]; changeAddress: Address } | null>(null);
  const [loaded, setLoaded] = useState<{ wallet: ConnectedWallet; locks: Timelock[] } | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ title: string; txHash: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([walletUtxos(wallet.connection), walletChangeAddress(wallet.connection)]).then(([utxos, changeAddress]) => {
      if (!cancelled) setFunds({ wallet, lovelace: lovelaceInUtxos(utxos), assets: assetsInUtxos(utxos), changeAddress });
    });
    findTimelocks(wallet.stakeAddress, wallet.keyHashes).then((locks) => {
      if (!cancelled) setLoaded({ wallet, locks });
    });
    return () => {
      cancelled = true;
    };
  }, [wallet, reload]);

  const walletFunds = funds?.wallet === wallet ? funds : null;
  const locks = loaded?.wallet === wallet ? loaded.locks : null;
  const walletAssets = useMemo(() => new Map((walletFunds?.assets ?? []).map((asset) => [assetKey(asset.policyId, asset.name), asset])), [walletFunds]);

  const dateError = date ? unlockDateError(date, now) : undefined;
  const unlockUnix = date && !dateError ? unlockUnixOfDate(date) : undefined;
  const unlockSlot = unlockUnix != null ? unixToSlot(unlockUnix) : undefined;

  const tokenErrors = tokenRows.map((row) => {
    const asset = walletAssets.get(row.key);
    if (!asset) return "Select a token";
    if (!/^\d+$/.test(row.amount) || BigInt(row.amount) <= 0n) return "Whole number ≥ 1";
    if (tokenRows.filter((other) => other.key === row.key).length > 1) return "Listed twice";
    return BigInt(row.amount) > asset.quantity ? `Only ${asset.quantity} in wallet` : undefined;
  });
  const tokensValid = tokenErrors.every((error) => !error);
  const tokens = useMemo(
    (): LockedToken[] =>
      tokenRows.flatMap((row) => {
        const asset = walletAssets.get(row.key);
        return asset && /^\d+$/.test(row.amount) && BigInt(row.amount) > 0n ? [{ policyId: asset.policyId, name: asset.name, quantity: BigInt(row.amount) }] : [];
      }),
    [tokenRows, walletAssets]
  );

  const typedLovelace = adaToLovelace(ada);
  // every output needs some ADA, tokens alone take the minimum along
  const minLovelace = useMemo(
    () => (walletFunds && unlockSlot != null && tokensValid ? minLockLovelace(walletFunds.changeAddress, wallet.keyHash, unlockSlot, tokens) : undefined),
    [walletFunds, unlockSlot, tokensValid, tokens, wallet.keyHash]
  );
  const lovelace = minLovelace != null && typedLovelace < minLovelace ? minLovelace : typedLovelace;
  const adaError = walletFunds && lovelace > walletFunds.lovelace ? "More than in wallet" : undefined;
  const somethingToLock = typedLovelace > 0n || tokens.length > 0;
  const canLock = unlockSlot != null && tokensValid && somethingToLock && !adaError && minLovelace != null && busy == null;

  const lockAddress = walletFunds && unlockSlot != null ? timelockAddress(walletFunds.changeAddress, wallet.keyHash, unlockSlot).to_bech32() : undefined;

  const lock = async () => {
    if (unlockSlot == null || unlockUnix == null) return;
    const what = [formatAda(Number(lovelace)), ...tokens.map(tokenLabel)].join(", ");
    if (!confirm(`Lock ${what} until ${formatDate(new Date(unlockUnix * 1000))} UTC?\n\nNobody can move it before that date, not even you, and it cannot be undone.`)) return;
    setBusy("lock");
    try {
      const txHash = await lockFunds(wallet.connection, wallet.keyHash, unlockSlot, lovelace, tokens);
      setResult({ title: "Lock submitted", txHash });
      setAda("");
      setTokenRows([]);
    } finally {
      setBusy(null);
    }
  };

  const unlock = async (lock: Timelock) => {
    setBusy(timelockKey(lock));
    try {
      const txHash = await unlockFunds(wallet.connection, [lock]);
      setResult({ title: "Unlock submitted", txHash });
    } finally {
      setBusy(null);
    }
  };

  if (result) {
    return (
      <TxResult
        title={result.title}
        txHashes={[result.txHash]}
        onReset={() => {
          setResult(null);
          setLoaded(null);
          setReload(reload + 1);
        }}
        resetLabel="Back to my locks"
      >
        <p className="text-sm text-base-content/65">The list of your locks follows the chain, it shows the change a moment after the confirmation.</p>
      </TxResult>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Notice>
        A lock sends ADA and tokens to an address that only a key of your wallet can spend from, and only after the date you pick. There is no way to take them out
        earlier, and nobody can help if the date was a mistake. The locked ADA keeps counting for your stake delegation. Nothing is stored here: the locks are found on
        chain, with this wallet in any browser.
      </Notice>

      <div className="surface flex flex-col gap-4 p-5">
        <p className="section-label">New lock</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Locked until (00:00 UTC of this day)" error={dateError} hint={`At most ${MAX_LOCK_DAYS} days ahead`}>
            <input
              className={inputClass}
              type="date"
              min={isoDate(now + DAY_SECONDS)}
              max={isoDate(now + MAX_LOCK_DAYS * DAY_SECONDS)}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field
            label="₳ to lock"
            error={adaError}
            hint={
              minLovelace != null && typedLovelace < minLovelace && somethingToLock
                ? `Raised to ${formatAda(Number(minLovelace))}, the least this output can hold`
                : walletFunds
                  ? `${formatAda(Number(walletFunds.lovelace))} in wallet, the transaction fee comes on top`
                  : undefined
            }
          >
            <input className={inputClass} type="number" min="0" step="1" value={ada} onChange={(e) => setAda(e.target.value)} placeholder="0" />
          </Field>
        </div>

        {tokenRows.map((row, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
            <select
              className="select w-full border-line bg-base-300"
              value={row.key}
              onChange={(e) => setTokenRows(tokenRows.map((other, i) => (i === index ? { ...other, key: e.target.value } : other)))}
            >
              <option value="">Select a token…</option>
              {[...walletAssets].map(([key, asset]) => (
                <option key={key} value={key}>
                  {assetNameFromHex(asset.name) || "(no name)"} · {shortenId(asset.policyId)} · {`${asset.quantity}`}
                </option>
              ))}
            </select>
            <Field label="" error={tokenErrors[index]}>
              <input
                className={inputClass}
                type="number"
                min="1"
                placeholder="Amount (smallest unit)"
                value={row.amount}
                onChange={(e) => setTokenRows(tokenRows.map((other, i) => (i === index ? { ...other, amount: e.target.value } : other)))}
              />
            </Field>
            <button type="button" className="btn btn-ghost btn-square text-base-content/45 hover:text-error" onClick={() => setTokenRows(tokenRows.filter((_, i) => i !== index))} aria-label="Remove token">
              <XMarkIcon className="size-4" />
            </button>
          </div>
        ))}
        <button type="button" className={`${secondaryButtonClass} w-fit`} onClick={() => setTokenRows([...tokenRows, { key: "", amount: "" }])} disabled={walletAssets.size === 0}>
          <PlusIcon className="size-4" />
          Add token
        </button>

        {lockAddress && unlockSlot != null ? (
          <details className="text-xs text-base-content/55">
            <summary className="cursor-pointer">Address and script of this lock</summary>
            <p className="mt-2 break-all font-mono">{lockAddress}</p>
            <pre className="mt-2 overflow-x-auto rounded-field bg-base-300 p-3 font-mono text-[11px]">{JSON.stringify(timelockScriptJson(wallet.keyHash, unlockSlot), null, 2)}</pre>
            <p className="mt-2">With this script and your wallet key the lock can be spent with any tool, also if this site is gone.</p>
          </details>
        ) : null}

        <div>
          <button className="btn btn-primary" disabled={!canLock} onClick={lock}>
            {busy === "lock" ? <span className="loading loading-spinner loading-sm" /> : <LockClosedIcon className="size-4" />}
            Lock
          </button>
        </div>
      </div>

      <div className="surface flex flex-col gap-4 p-5">
        <p className="section-label">My locks</p>
        {!locks ? (
          <div className="flex justify-center py-6">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        ) : locks.length === 0 ? (
          <p className="text-sm text-base-content/55">This wallet has nothing locked.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {locks.map((lock) => {
              const key = timelockKey(lock);
              const open = isUnlockable(lock);
              return (
                <li key={key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <div className="min-w-0">
                    <p className="text-sm font-medium tabular-nums">
                      {formatAda(Number(lock.lovelace))}
                      {lock.tokens.length > 0 ? <span className="font-normal text-base-content/65"> + {lock.tokens.map(tokenLabel).join(", ")}</span> : null}
                    </p>
                    <p className="text-xs text-base-content/55">
                      {open ? "Unlocked since" : "Locked until"} {formatDate(unlockDate(lock))} UTC
                    </p>
                    <p className="truncate font-mono text-[11px] text-base-content/45" title={lock.address}>
                      {shortenId(lock.address, 14)}
                    </p>
                  </div>
                  {open ? (
                    <button className="btn btn-primary btn-sm shrink-0" disabled={busy != null} onClick={() => unlock(lock)}>
                      {busy === key ? <span className="loading loading-spinner loading-xs" /> : <LockOpenIcon className="size-4" />}
                      Take back
                    </button>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-base-content/55">
                      <LockClosedIcon className="size-4" />
                      locked
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function TimelockForm() {
  return <ConnectWallet message="Connect a wallet to lock ADA and tokens or to take back what you have locked.">{(wallet) => <Timelocks wallet={wallet} />}</ConnectWallet>;
}
