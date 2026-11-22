"use client";

import { assetKey, assetsInUtxos, lovelaceInUtxos, WalletAsset } from "@cardano/assets";
import { distribute, NotEnoughFundsError, RewardPosition, RewardToken } from "@cardano/distribution";
import { IS_MAINNET } from "@cardano/network";
import { CHIEN_POOL_ID } from "@cardano/pool";
import { batchPositions, DistributionProgress, minLovelaceForOutput, sendRewards } from "@cardano/rewards";
import { currentEpoch, walletUtxos } from "@cardano/transaction";
import { assetNameFromHex, formatAda, formatNumber, shortenId } from "@cardano/utils";
import ConnectWallet from "@components/ConnectWallet";
import TxResult from "@components/TxResult";
import { Field, inputClass, Notice, secondaryButtonClass } from "@components/ui";
import { ConnectedWallet } from "@components/useWallet";
import { PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import { LoadedStakers, loadStakers } from "./loadStakers";

/** Mainnet has stake snapshots since Shelley started in epoch 208. */
const FIRST_STAKE_EPOCH = IS_MAINNET ? 208 : 0;
const MESSAGE_MAX_BYTES = 64;
const VISIBLE_ROWS = 200;

interface Pool {
  tickerName: string;
  poolHash: string;
}

interface TokenRow {
  key: string;
  amount: string;
}

const isPoolId = (value: string) => /^pool1[a-z0-9]{51}$/.test(value);

/** Accepts a pool id or the ticker of a pool. */
function resolvePool(input: string, pools: Pool[]) {
  const value = input.trim();
  if (isPoolId(value)) return value;
  const matches = pools.filter((pool) => pool.tickerName?.toLowerCase() === value.toLowerCase());
  return matches.length === 1 ? matches[0].poolHash : undefined;
}

function adaToLovelace(ada: string) {
  const value = Number(ada);
  return ada.trim() !== "" && Number.isFinite(value) && value > 0 ? BigInt(Math.round(value * 1_000_000)) : 0n;
}

function Rewards({ wallet, pools }: { wallet: ConnectedWallet; pools: Pool[] }) {
  const [poolInput, setPoolInput] = useState(IS_MAINNET ? CHIEN_POOL_ID : "");
  const [epoch, setEpoch] = useState(() => `${currentEpoch()}`);
  const [minStake, setMinStake] = useState("1000");
  const [ada, setAda] = useState("");
  const [tokenRows, setTokenRows] = useState<TokenRow[]>([]);
  const [message, setMessage] = useState("");
  const [tip, setTip] = useState(true);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState<{ pool: string; epoch: number; data: LoadedStakers } | null>(null);
  const [loading, setLoading] = useState(false);
  const [funds, setFunds] = useState<{ wallet: ConnectedWallet; lovelace: bigint; assets: WalletAsset[] } | null>(null);
  const [progress, setProgress] = useState<DistributionProgress | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    walletUtxos(wallet.connection).then((utxos) => {
      if (!cancelled) setFunds({ wallet, lovelace: lovelaceInUtxos(utxos), assets: assetsInUtxos(utxos) });
    });
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const walletFunds = funds?.wallet === wallet ? funds : null;
  const walletAssets = useMemo(() => new Map((walletFunds?.assets ?? []).map((asset) => [assetKey(asset.policyId, asset.name), asset])), [walletFunds]);

  const poolHash = resolvePool(poolInput, pools);
  const epochNo = Number(epoch);
  const stakersCurrent = loaded && loaded.pool === poolHash && loaded.epoch === epochNo ? loaded.data : null;

  const load = async () => {
    if (!poolHash) return;
    setLoading(true);
    try {
      setLoaded({ pool: poolHash, epoch: epochNo, data: await loadStakers(poolHash, epochNo) });
      setExcluded(new Set());
    } finally {
      setLoading(false);
    }
  };

  const tokens = useMemo(
    (): RewardToken[] =>
      tokenRows.flatMap((row) => {
        const asset = walletAssets.get(row.key);
        return asset && /^\d+$/.test(row.amount) && BigInt(row.amount) > 0n ? [{ policyId: asset.policyId, name: asset.name, amount: BigInt(row.amount) }] : [];
      }),
    [tokenRows, walletAssets]
  );
  const tokenErrors = tokenRows.map((row) => {
    const asset = walletAssets.get(row.key);
    if (!asset) return "Select a token";
    if (!/^\d+$/.test(row.amount) || BigInt(row.amount) <= 0n) return "Whole number ≥ 1";
    return BigInt(row.amount) > asset.quantity ? `Only ${asset.quantity} in wallet` : undefined;
  });

  const lovelace = adaToLovelace(ada);
  const minStakeLovelace = adaToLovelace(minStake);
  const messageBytes = new TextEncoder().encode(message.trim()).length;

  const eligible = useMemo(
    () => (stakersCurrent?.stakers ?? []).filter((staker) => BigInt(staker.amount) > minStakeLovelace).sort((a, b) => b.amount - a.amount),
    [stakersCurrent, minStakeLovelace]
  );

  const distribution = useMemo((): { positions: RewardPosition[]; error?: string } => {
    const stakers = eligible.filter((staker) => !excluded.has(staker.stakeAddress)).map((staker) => ({ ...staker, amount: BigInt(staker.amount) }));
    if (stakers.length === 0 || lovelace === 0n) {
      return { positions: [] };
    }
    try {
      return { positions: distribute(stakers, { lovelace, tokens }, tip ? stakersCurrent?.tipAddress : undefined, minLovelaceForOutput) };
    } catch (error) {
      if (error instanceof NotEnoughFundsError) {
        return { positions: [], error: `Every staker needs a minimum output, distribute at least ${formatAda(Number(error.required))}.` };
      }
      throw error;
    }
  }, [eligible, excluded, lovelace, tokens, tip, stakersCurrent]);

  const positionByStake = useMemo(() => new Map(distribution.positions.map((position) => [position.stakeAddress, position])), [distribution]);
  const batches = useMemo(() => batchPositions(distribution.positions), [distribution]);
  const tipPosition = distribution.positions.find((position) => position.tip);

  const exceedsWallet = walletFunds != null && lovelace > walletFunds.lovelace;
  const canSend = distribution.positions.length > 0 && tokenErrors.every((error) => !error) && messageBytes <= MESSAGE_MAX_BYTES && !exceedsWallet && !sending;

  const send = async () => {
    const recipients = distribution.positions.filter((position) => !position.tip).length;
    if (!confirm(`Send ${formatAda(Number(lovelace))} to ${recipients} stakers in ${batches.length} transaction${batches.length === 1 ? "" : "s"}?`)) return;
    setSending(true);
    try {
      await sendRewards(wallet.connection, batches, message, setProgress);
    } finally {
      setSending(false);
    }
  };

  if (progress?.state === "done") {
    return (
      <TxResult title="Rewards sent" txHashes={progress.txHashes} onReset={() => setProgress(null)} resetLabel="Distribute again">
        <p className="text-sm text-base-content/65">
          {distribution.positions.filter((position) => !position.tip).length} stakers of epoch {epochNo} received their share.
        </p>
      </TxResult>
    );
  }

  const toggleExcluded = (stakeAddress: string) => {
    const next = new Set(excluded);
    if (!next.delete(stakeAddress)) next.add(stakeAddress);
    setExcluded(next);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="surface grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Pool id or ticker" error={poolHash ? undefined : "Unknown pool"} className="sm:col-span-2">
          <input className={`${inputClass} font-mono text-xs`} value={poolInput} onChange={(e) => setPoolInput(e.target.value)} list="pool-tickers" placeholder="CHIEN or pool1…" />
          <datalist id="pool-tickers">
            {pools.map((pool) => (
              <option key={pool.poolHash} value={pool.poolHash}>
                {pool.tickerName}
              </option>
            ))}
          </datalist>
        </Field>
        <Field label="Epoch" hint="Stake snapshot the shares are based on">
          <input className={inputClass} type="number" min={FIRST_STAKE_EPOCH} max={currentEpoch()} value={epoch} onChange={(e) => setEpoch(e.target.value)} />
        </Field>
        <Field label="Minimum ₳ delegated">
          <input className={inputClass} type="number" min="0" value={minStake} onChange={(e) => setMinStake(e.target.value)} />
        </Field>
        <div className="sm:col-span-2 lg:col-span-4">
          <button className="btn btn-primary btn-sm" onClick={load} disabled={!poolHash || !(epochNo >= FIRST_STAKE_EPOCH) || loading}>
            {loading ? <span className="loading loading-spinner loading-xs" /> : null}
            {stakersCurrent ? "Reload stakers" : "Load stakers"}
          </button>
        </div>
      </div>

      <div className="surface flex flex-col gap-4 p-5">
        <p className="section-label">Funds from your wallet</p>
        <div className="grid gap-4 sm:grid-cols-[14rem_minmax(0,1fr)]">
          <Field
            label="₳ to distribute"
            error={exceedsWallet ? "More than in wallet" : undefined}
            hint={walletFunds ? `${formatAda(Number(walletFunds.lovelace))} in wallet, transaction fees come on top` : undefined}
          >
            <input className={inputClass} type="number" min="0" step="1" value={ada} onChange={(e) => setAda(e.target.value)} placeholder="100" />
          </Field>
          <Field label={`Message (optional, ${messageBytes}/${MESSAGE_MAX_BYTES} bytes)`} error={messageBytes > MESSAGE_MAX_BYTES ? "Too long" : undefined}>
            <input className={inputClass} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Thank you for staking with us" />
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

        {IS_MAINNET ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="checkbox checkbox-sm" checked={tip} onChange={(e) => setTip(e.target.checked)} />
            Tip 1 ₳ plus the rounding remainder to the [CHIEN] pool, which runs Cardano Tools
          </label>
        ) : null}
      </div>

      {distribution.error ? <Notice tone="warning">{distribution.error}</Notice> : null}

      {stakersCurrent ? (
        <div className="surface flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-base-content/65">
              {eligible.length - excluded.size} of {stakersCurrent.stakers.length} stakers in epoch {epochNo}
              {distribution.positions.length > 0 ? ` · ${batches.length} transaction${batches.length === 1 ? "" : "s"}` : ""}
              {tipPosition ? ` · tip ${formatAda(Number(tipPosition.lovelace))}` : ""}
            </p>
            <button className="btn btn-primary" disabled={!canSend} onClick={send}>
              {sending ? <span className="loading loading-spinner loading-sm" /> : null}
              Distribute
            </button>
          </div>

          {progress ? (
            <Notice>
              Transaction {progress.batch} of {progress.batches}: {progress.state === "signing" ? "waiting for your signature" : "sent, waiting for your wallet to pick it up before the next one"}
            </Notice>
          ) : null}

          {eligible.length === 0 ? (
            <p className="text-sm text-base-content/55">No stakers found for this pool, epoch and minimum stake.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr className="text-xs text-base-content/55">
                    <th>Stake address</th>
                    <th className="text-right">Stake</th>
                    <th className="text-right">Share</th>
                    <th className="text-right">Receives</th>
                    <th className="text-right">Exclude</th>
                  </tr>
                </thead>
                <tbody>
                  {eligible.slice(0, VISIBLE_ROWS).map((staker) => {
                    const position = positionByStake.get(staker.stakeAddress);
                    return (
                      <tr key={staker.stakeAddress} className={excluded.has(staker.stakeAddress) ? "opacity-40" : ""}>
                        <td className="font-mono text-xs" title={staker.stakeAddress}>
                          {shortenId(staker.stakeAddress, 10)}
                        </td>
                        <td className="text-right tabular-nums">{formatAda(staker.amount)}</td>
                        <td className="text-right tabular-nums">{position ? `${formatNumber(position.share * 100)} %` : ""}</td>
                        <td className="text-right tabular-nums">
                          {position ? formatAda(Number(position.lovelace)) : ""}
                          {position && position.tokens.size > 0 ? <span className="text-base-content/55"> + {[...position.tokens.values()].map((amount) => `${amount}`).join(" / ")}</span> : null}
                        </td>
                        <td className="text-right">
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs"
                            checked={excluded.has(staker.stakeAddress)}
                            onChange={() => toggleExcluded(staker.stakeAddress)}
                            aria-label={`Exclude ${staker.stakeAddress}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {eligible.length > VISIBLE_ROWS ? <p className="px-3 py-2 text-xs text-base-content/45">Showing the {VISIBLE_ROWS} largest of {eligible.length} stakers, all of them are paid.</p> : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function RewardsForm({ pools }: { pools: Pool[] }) {
  return <ConnectWallet message="Connect the wallet that holds the ADA and tokens you want to distribute.">{(wallet) => <Rewards wallet={wallet} pools={pools} />}</ConnectWallet>;
}
