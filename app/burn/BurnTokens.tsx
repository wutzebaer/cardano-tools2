"use client";

import { assetKey, assetsInUtxos, WalletAsset } from "@cardano/assets";
import { BLACK_HOLE_ADDRESS, BurnItem, burnTokens, findReferenceUtxos, referenceNameFor } from "@cardano/burn";
import { getTokenDetails } from "@cardano/dbsync";
import { policySecondsLeft } from "@cardano/mint";
import { explorerAddressUrl } from "@cardano/network";
import { walletUtxos } from "@cardano/transaction";
import { MintPolicy, TokenListItem } from "@cardano/types";
import { assetNameFromHex, shortenId, toIpfsUrl } from "@cardano/utils";
import ConnectWallet from "@components/ConnectWallet";
import IpfsImage from "@components/IpfsImage";
import TokenImagePlaceholder from "@components/TokenImagePlaceholder";
import TxResult from "@components/TxResult";
import { ExternalLink, Notice } from "@components/ui";
import { ConnectedWallet } from "@components/useWallet";
import { useEffect, useMemo, useState } from "react";
import { usePolicies } from "../mint/usePolicies";
import { loadAddressTokens } from "../my/loadTokens";

const LOCKED_SCRIPT = '{"type": "all", "scripts": [{"type": "before", "slot": 0}]}';

interface WalletTokens {
  assets: WalletAsset[];
  /** Names and images from the chain index, keyed by `policyId.assetName` */
  info: Map<string, TokenListItem>;
}

async function loadWalletTokens(wallet: ConnectedWallet): Promise<WalletTokens> {
  const [utxos, listed] = await Promise.all([
    walletUtxos(wallet.connection),
    // names and images are a nicety, burning works without them
    loadAddressTokens(wallet.stakeAddress).catch(() => null),
  ]);
  const info = new Map((listed?.tokens ?? []).map((token) => [assetKey(token.maPolicyId, token.maName), token]));
  return { assets: assetsInUtxos(utxos), info };
}

/** Adds the reference NFT of CIP-68 tokens whose whole supply gets burned, so its locked ADA comes back. */
async function withReferences(wallet: ConnectedWallet, policy: MintPolicy, items: BurnItem[]): Promise<BurnItem[]> {
  if (!items.some((item) => referenceNameFor(item.asset.name))) {
    return items;
  }
  try {
    const references = await findReferenceUtxos(wallet.connection, policy, wallet.keyHashes);
    return await Promise.all(
      items.map(async (item) => {
        const reference = references.get(referenceNameFor(item.asset.name) ?? "");
        if (!reference) return item;
        const details = await getTokenDetails(policy.policyId, item.asset.name);
        return BigInt(details.totalSupply) === item.amount ? { ...item, reference } : item;
      })
    );
  } catch {
    // without chain data only the tokens themselves are burned
    return items;
  }
}

function Burn({ wallet }: { wallet: ConnectedWallet }) {
  const { policies, loading: policiesLoading } = usePolicies(wallet);
  const [loaded, setLoaded] = useState<{ wallet: ConnectedWallet; tokens: WalletTokens } | null>(null);
  const [reload, setReload] = useState(0);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [burning, setBurning] = useState<string | null>(null);
  const [txHashes, setTxHashes] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadWalletTokens(wallet).then((tokens) => {
      if (!cancelled) setLoaded({ wallet, tokens });
    });
    return () => {
      cancelled = true;
    };
  }, [wallet, reload]);

  const tokens = loaded?.wallet === wallet ? loaded.tokens : null;

  const groups = useMemo(() => {
    const burnable = policies.filter((policy) => policySecondsLeft(policy) > 0);
    return burnable
      .map((policy) => ({ policy, assets: (tokens?.assets ?? []).filter((asset) => asset.policyId === policy.policyId) }))
      .filter((group) => group.assets.length > 0);
  }, [policies, tokens]);

  const otherTokens = (tokens?.assets.length ?? 0) - groups.reduce((sum, group) => sum + group.assets.length, 0);

  const selectedItems = (assets: WalletAsset[]): BurnItem[] =>
    assets.flatMap((asset) => {
      const amount = amounts[assetKey(asset.policyId, asset.name)];
      return amount && /^\d+$/.test(amount) && BigInt(amount) > 0n && BigInt(amount) <= asset.quantity ? [{ asset, amount: BigInt(amount) }] : [];
    });

  const setAmount = (key: string, amount: string | null) => {
    const rest = Object.fromEntries(Object.entries(amounts).filter(([other]) => other !== key));
    setAmounts(amount ? { ...rest, [key]: amount } : rest);
  };

  const burn = async (policy: MintPolicy, assets: WalletAsset[]) => {
    const items = selectedItems(assets);
    if (!confirm(`Burn ${items.length} token${items.length === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setBurning(policy.policyId);
    try {
      const txHash = await burnTokens(wallet.connection, policy, await withReferences(wallet, policy, items), wallet.keyHashes);
      setTxHashes([txHash]);
      setAmounts({});
    } finally {
      setBurning(null);
    }
  };

  if (txHashes.length > 0) {
    return (
      <TxResult
        title="Burn submitted"
        txHashes={txHashes}
        onReset={() => {
          setTxHashes([]);
          setReload(reload + 1);
        }}
        resetLabel="Burn more"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {!tokens || policiesLoading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-md text-primary" />
        </div>
      ) : groups.length === 0 ? (
        <div className="surface px-6 py-16 text-center text-sm text-base-content/55">
          Your wallet holds no tokens of a policy you can still sign for. Policies imported on the Mint page show up here as well.
        </div>
      ) : null}

      {groups.map(({ policy, assets }) => {
        const selected = selectedItems(assets);
        return (
          <section key={policy.policyId} className="surface flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="section-label">{policy.name ?? "Policy"}</p>
                <p className="break-all font-mono text-xs text-base-content/45">{policy.policyId}</p>
              </div>
              <button className="btn btn-error btn-sm" disabled={selected.length === 0 || burning != null} onClick={() => burn(policy, assets)}>
                {burning === policy.policyId ? <span className="loading loading-spinner loading-xs" /> : null}
                Burn {selected.length || ""} selected
              </button>
            </div>
            <ul className="flex flex-col divide-y divide-line">
              {assets.map((asset) => {
                const key = assetKey(asset.policyId, asset.name);
                const info = tokens?.info.get(key);
                const amount = amounts[key];
                const image = toIpfsUrl(info?.image);
                return (
                  <li key={key} className="flex items-center gap-3 py-2.5">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={amount != null}
                      onChange={() => setAmount(key, amount == null ? `${asset.quantity}` : null)}
                      aria-label={`Select ${info?.name ?? asset.name}`}
                    />
                    <div className="size-10 shrink-0 overflow-hidden rounded-field bg-base-300">
                      {image ? <IpfsImage src={image} alt="" width="64" height="64" className="size-10 object-cover" /> : <TokenImagePlaceholder />}
                    </div>
                    <div className="min-w-0 grow">
                      <p className="truncate text-sm font-medium">{info?.name || assetNameFromHex(asset.name) || "(no name)"}</p>
                      <p className="truncate font-mono text-[11px] text-base-content/45">{info?.maFingerprint ?? shortenId(asset.name, 10)}</p>
                    </div>
                    {asset.quantity > 1n ? (
                      <label className="flex shrink-0 items-center gap-2 text-xs text-base-content/55">
                        <input
                          className="input input-sm w-32 border-line bg-base-300 text-right"
                          type="number"
                          min="1"
                          max={`${asset.quantity}`}
                          placeholder="0"
                          value={amount ?? ""}
                          onChange={(e) => setAmount(key, e.target.value || null)}
                        />
                        of {`${asset.quantity}`}
                      </label>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {otherTokens > 0 ? (
        <Notice>
          {otherTokens} other token{otherTokens === 1 ? "" : "s"} in your wallet cannot be burned here: the policy is locked or signed by a key that is neither in your
          wallet nor imported.
        </Notice>
      ) : null}

      <details className="surface p-5 text-sm">
        <summary className="cursor-pointer font-medium">Tokens of a locked or foreign policy: the black hole address</summary>
        <div className="mt-3 flex flex-col gap-3 text-base-content/65">
          <p>Tokens of a policy you cannot sign for cannot be burned, only locked away forever. Whatever is sent to this address never comes out again, but the tokens stay in the total supply.</p>
          <p className="break-all font-mono text-xs">{BLACK_HOLE_ADDRESS}</p>
          <p>
            It is the address of the script <span className="font-mono text-xs">{LOCKED_SCRIPT}</span>, which is only valid before slot 0 and can therefore never spend
            anything. Verify it with <span className="font-mono text-xs">cardano-cli address build --payment-script-file locked_script.json</span>.
          </p>
          <div>
            <ExternalLink href={explorerAddressUrl(BLACK_HOLE_ADDRESS)}>cexplorer</ExternalLink>
          </div>
        </div>
      </details>
    </div>
  );
}

export default function BurnTokens() {
  return <ConnectWallet message="Connect a wallet to burn tokens of policies signed by your wallet key.">{(wallet) => <Burn wallet={wallet} />}</ConnectWallet>;
}
