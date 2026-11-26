"use client";

import { assetsInUtxos, lovelaceInUtxos } from "@cardano/assets";
import { getStakeCheck } from "@cardano/dbsync";
import { moveEverything, MoveProgress } from "@cardano/moveWallet";
import { walletUtxos } from "@cardano/transaction";
import { assetNameFromHex, formatAda, shortenId } from "@cardano/utils";
import ConnectWallet from "@components/ConnectWallet";
import TxResult from "@components/TxResult";
import { Field, Notice, textareaClass } from "@components/ui";
import { ConnectedWallet } from "@components/useWallet";
import { Address, BaseAddress, TransactionUnspentOutput } from "@emurgo/cardano-serialization-lib-browser";
import { useEffect, useState } from "react";

type Staking = NonNullable<Awaited<ReturnType<typeof getStakeCheck>>>;

const KEY_DEPOSIT = 2_000_000;
const VISIBLE_TOKENS = 12;

function parseAddress(bech32: string) {
  try {
    return Address.from_bech32(bech32.trim());
  } catch {
    return null;
  }
}

/** The stake key behind a payment address, to notice a target that belongs to the wallet being emptied. */
const stakeKeyOf = (address: Address) => BaseAddress.from_address(address)?.stake_cred().to_keyhash()?.to_hex();

function Move({ wallet }: { wallet: ConnectedWallet }) {
  const [target, setTarget] = useState("");
  const [loaded, setLoaded] = useState<{ wallet: ConnectedWallet; utxos: TransactionUnspentOutput[]; staking: Staking | null } | null>(null);
  const [reload, setReload] = useState(0);
  const [unstake, setUnstake] = useState(true);
  const [progress, setProgress] = useState<MoveProgress | null>(null);
  const [sending, setSending] = useState(false);
  const [txHashes, setTxHashes] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    // the staking state is a help, the wallet can be moved without it
    Promise.all([walletUtxos(wallet.connection), getStakeCheck(wallet.stakeAddress).catch(() => null)]).then(([utxos, staking]) => {
      if (!cancelled) setLoaded({ wallet, utxos, staking });
    });
    return () => {
      cancelled = true;
    };
  }, [wallet, reload]);

  const current = loaded?.wallet === wallet ? loaded : null;
  const utxos = current?.utxos ?? [];
  const staking = current?.staking ?? null;
  const lovelace = lovelaceInUtxos(utxos);
  const assets = assetsInUtxos(utxos);

  const targetAddress = parseAddress(target);
  const ownStakeKey = parseAddress(wallet.changeAddress) ? stakeKeyOf(Address.from_bech32(wallet.changeAddress)) : undefined;
  const sameWallet = targetAddress != null && ownStakeKey != null && stakeKeyOf(targetAddress) === ownStakeKey;
  const targetError = target.trim() === "" ? undefined : !targetAddress ? "Not a valid address" : sameWallet ? "This address belongs to the wallet you are emptying" : undefined;

  const registered = staking?.registered === true;
  const rewards = staking?.rewardsAvailable ?? 0;
  // the chain pays rewards out only after the choice about the voting rights, and deregisters no key with rewards left:
  // such a wallet gets the choice "do not take part" made first, in a transaction of its own
  const needsVoteFirst = registered && rewards > 0 && !staking?.drepId;
  const willUnstake = registered && unstake;
  const arriving = Number(lovelace) + (willUnstake ? KEY_DEPOSIT + rewards : 0);

  const send = async () => {
    if (!targetAddress) return;
    const what = [`${formatAda(Number(lovelace))}`, assets.length > 0 ? `${assets.length} kind${assets.length === 1 ? "" : "s"} of tokens` : null, willUnstake ? "the staking deposit and rewards" : null]
      .filter(Boolean)
      .join(", ");
    if (!confirm(`Send everything in this wallet (${what}) to\n\n${target.trim()}\n\nCompare the address with the one your new wallet shows. This cannot be undone.`)) return;
    setSending(true);
    try {
      setTxHashes(await moveEverything(wallet.connection, targetAddress, willUnstake ? BigInt(rewards) : null, willUnstake && needsVoteFirst, setProgress));
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  if (txHashes) {
    return (
      <TxResult
        title="Wallet emptied"
        txHashes={txHashes}
        support={false}
        onReset={() => {
          setTxHashes(null);
          setLoaded(null);
          setReload(reload + 1);
        }}
        resetLabel="Check the wallet again"
      >
        <p className="text-sm text-base-content/65">Once confirmed, everything is at the new address. The new wallet has to be delegated to a pool again to earn rewards.</p>
      </TxResult>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Notice>
        For giving up a wallet or moving to a new one: everything the connected wallet holds, all ADA and all tokens, goes to the address you enter, in as few transactions as
        possible. Nothing is left behind for fees, so make sure the address belongs to a wallet you control.
      </Notice>

      <div className="surface flex flex-col gap-5 p-5">
        <Field label="Send everything to" error={targetError} hint="A receive address of the new wallet, addr1…">
          <textarea className={`${textareaClass} font-mono text-xs`} rows={2} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="addr1…" />
        </Field>

        {!current ? (
          <span className="loading loading-spinner loading-md text-primary" />
        ) : (
          <>
            <div>
              <p className="section-label">In this wallet ({wallet.info.name})</p>
              <p className="mt-1">
                <span className="text-brand text-2xl font-semibold tracking-tight">{formatAda(Number(lovelace))}</span>
                <span className="ml-2 text-sm text-base-content/55">
                  in {utxos.length} UTxO{utxos.length === 1 ? "" : "s"}
                  {assets.length > 0 ? `, ${assets.length} kind${assets.length === 1 ? "" : "s"} of tokens` : ", no tokens"}
                </span>
              </p>
              {assets.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-0.5 font-mono text-xs text-base-content/65">
                  {assets.slice(0, VISIBLE_TOKENS).map((asset) => (
                    <li key={`${asset.policyId}.${asset.name}`}>
                      {`${asset.quantity}`} {asset.name ? assetNameFromHex(asset.name) || "(no name)" : "Royalty token"} · {shortenId(asset.policyId)}
                    </li>
                  ))}
                  {assets.length > VISIBLE_TOKENS ? <li>and {assets.length - VISIBLE_TOKENS} more</li> : null}
                </ul>
              ) : null}
            </div>

            {registered ? (
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" className="checkbox checkbox-sm mt-0.5" checked={willUnstake} onChange={(e) => setUnstake(e.target.checked)} />
                  <span>
                    Stop staking with this wallet as well
                    <span className="block text-base-content/65">
                      Deregisters the stake key, which returns its {formatAda(KEY_DEPOSIT)} deposit{rewards > 0 ? ` and pays out ${formatAda(rewards)} of rewards` : ""}. Both go to the
                      new address too.
                    </span>
                  </span>
                </label>
                {willUnstake && needsVoteFirst ? (
                  <p className="text-sm text-base-content/65">
                    One signature more than usual: Cardano only pays the {formatAda(rewards)} of rewards out once the wallet has decided about its voting rights. So the first
                    transaction chooses &quot;do not take part&quot;, and when it is confirmed, which takes a minute or two, the wallet is emptied.
                  </p>
                ) : null}
              </div>
            ) : null}

            <p className="text-sm text-base-content/65">
              About <span className="text-brand inline-block text-base font-semibold">{formatAda(arriving)}</span> arrive at the new address, less the transaction fee of about 0.2 ₳. What is locked in a timelock stays where it is until you take it
              back.
            </p>
          </>
        )}

        {progress ? (
          <Notice>
            {progress.preparing === "sign"
              ? "Step 1: sign the choice about the voting rights"
              : progress.preparing === "confirming"
                ? "Step 1 is sent, waiting for its confirmation. Keep this page open"
                : progress.preparing === "wallet"
                  ? "Step 1 is confirmed, waiting until your wallet shows it"
                  : `Waiting for your signature, ${progress.remaining} UTxO${progress.remaining === 1 ? "" : "s"} left to move`}
          </Notice>
        ) : null}

        <div>
          <button className="btn btn-primary" disabled={!current || utxos.length === 0 || !targetAddress || Boolean(targetError) || sending} onClick={send}>
            {sending ? <span className="loading loading-spinner loading-sm" /> : null}
            Send everything
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MoveWallet() {
  return <ConnectWallet message="Connect the wallet you want to empty.">{(wallet) => <Move wallet={wallet} />}</ConnectWallet>;
}
