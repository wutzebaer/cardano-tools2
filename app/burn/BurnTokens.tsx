"use client";

import { answered } from "@cardano/answer";
import { assetKey, assetsInUtxos, WalletAsset } from "@cardano/assets";
import { DEAD_ADDRESS, BurnItem, burnTokens, findReferenceUtxos, referenceNameFor } from "@cardano/burn";
import { getPolicyCollection, getTokenDetails } from "@cardano/dbsync";
import { burnTokens as burnDropTokensOf, DropState, loadDrop } from "@cardano/drop";
import { MAX_BURNS } from "@cardano/dropTx";
import { USER_LABEL } from "@cardano/dropScript";
import { policySecondsLeft } from "@cardano/mint";
import { explorerAddressUrl } from "@cardano/network";
import { walletUtxos } from "@cardano/transaction";
import { MintPolicy, TokenListItem } from "@cardano/types";
import { technicalToken } from "@cardano/technicalToken";
import { assetNameFromHex, shortenId, toIpfsUrl } from "@cardano/utils";
import ConnectWallet from "@components/ConnectWallet";
import IpfsImage from "@components/IpfsImage";
import TokenImagePlaceholder from "@components/TokenImagePlaceholder";
import TxResult from "@components/TxResult";
import { ExternalLink, Notice } from "@components/ui";
import { ConnectedWallet } from "@components/useWallet";
import Link from "next/link";
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
    answered(loadAddressTokens(wallet.stakeAddress)).catch(() => null),
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

/** Drops looked up for the tokens of a wallet at most, each takes a request. */
const MAX_DROPS = 40;

interface DropTokens {
  state: DropState;
  /** The name the seller registered for the collection, if any */
  name?: string;
  assets: WalletAsset[];
}

/**
 * The tokens of the wallet that come from a drop whose tokens may be burned. Their policy is the contract of the drop,
 * which lets the owner of a token burn it and returns the deposit of its metadata.
 */
async function loadDropTokens(assets: WalletAsset[], ownPolicies: Set<string>): Promise<DropTokens[]> {
  const byPolicy = new Map<string, WalletAsset[]>();
  for (const asset of assets) {
    // the wallet's own policies are no drops, they are listed above
    if (ownPolicies.has(asset.policyId)) continue;
    // the tokens people bought, and the royalty token the seller got when creating the drop
    if (!asset.name.startsWith(USER_LABEL) && asset.name !== "") continue;
    byPolicy.set(asset.policyId, [...(byPolicy.get(asset.policyId) ?? []), asset]);
  }
  const found = await Promise.all(
    [...byPolicy.entries()].slice(0, MAX_DROPS).map(async ([policyId, held]) => {
      // most policies are no drop, and one that cannot be read is left out
      const state = await loadDrop(policyId).catch(() => null);
      if (!state?.config.burnable) return [];
      return [{ state, name: (await getPolicyCollection(policyId))?.name, assets: held }];
    })
  );
  return found.flat();
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

  const [drops, setDrops] = useState<DropTokens[]>([]);
  useEffect(() => {
    if (!tokens) return;
    let cancelled = false;
    loadDropTokens(tokens.assets, new Set(policies.map((policy) => policy.policyId))).then((found) => {
      if (!cancelled) setDrops(found);
    });
    return () => {
      cancelled = true;
    };
  }, [tokens, policies]);

  const groups = useMemo(() => {
    const burnable = policies.filter((policy) => policySecondsLeft(policy) > 0);
    return burnable
      .map((policy) => ({ policy, assets: (tokens?.assets ?? []).filter((asset) => asset.policyId === policy.policyId) }))
      .filter((group) => group.assets.length > 0);
  }, [policies, tokens]);

  const otherTokens = (tokens?.assets.length ?? 0) - groups.reduce((sum, group) => sum + group.assets.length, 0) - drops.reduce((sum, drop) => sum + drop.assets.length, 0);

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

  const burnDropTokens = async (drop: DropTokens) => {
    const selected = selectedItems(drop.assets);
    const items = selected.filter((item) => item.asset.name !== "");
    const royaltyToken = selected.length > items.length;
    const question = [
      `Burn ${selected.length} token${selected.length === 1 ? "" : "s"}?`,
      ...(items.length ? ["Bought tokens are destroyed for good and nobody can buy them again. You get back the deposit of their metadata, about 1.5 ADA each. The price you paid is not returned."] : []),
      ...(royaltyToken ? ["Burning the royalty token changes nothing about the royalties and the name of the collection, which its mint set. You get back the ADA it holds."] : []),
    ].join("\n\n");
    if (!confirm(question)) return;
    setBurning(drop.state.drop.policyId);
    try {
      setTxHashes([await burnDropTokensOf(wallet.connection, drop.state, items.map((item) => assetNameFromHex(item.asset.name)), royaltyToken)]);
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
      ) : groups.length === 0 && drops.length === 0 ? (
        <div className="surface px-6 py-16 text-center text-sm text-base-content/55">
          Your wallet holds no tokens of a policy you can still sign for.
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
                // the token without an asset name is the royalty token of CIP-27, shown as in the token lists
                const isRoyaltyToken = !asset.name;
                const name = info?.name || technicalToken(asset.name)?.name || assetNameFromHex(asset.name) || "(no name)";
                return (
                  <li key={key} className="flex items-center gap-3 py-2.5">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={amount != null}
                      onChange={() => setAmount(key, amount == null ? `${asset.quantity}` : null)}
                      aria-label={`Select ${name}`}
                    />
                    <div className="size-10 shrink-0 overflow-hidden rounded-field bg-base-300">
                      {image ? <IpfsImage src={image} alt="" width="64" height="64" className="size-10 object-cover" /> : <TokenImagePlaceholder royalty={isRoyaltyToken} />}
                    </div>
                    <div className="min-w-0 grow">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{name}</span>
                        {isRoyaltyToken ? <span className="shrink-0 rounded-full bg-warning/90 px-2 py-0.5 text-[11px] font-semibold text-warning-content">Royalties</span> : null}
                      </p>
                      {isRoyaltyToken ? <p className="truncate text-xs text-base-content/55">Sets the royalties of this policy</p> : null}
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

      {drops.map((drop) => {
        const selected = selectedItems(drop.assets);
        const tooMany = selected.filter((item) => item.asset.name !== "").length > MAX_BURNS;
        return (
          <section key={drop.state.drop.policyId} className="surface flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="section-label">
                  <Link className="hover:text-base-content" href={`/drop/${drop.state.drop.policyId}`}>
                    {drop.name ?? "Drop"}
                  </Link>
                </p>
                <p className="break-all font-mono text-xs text-base-content/45">{drop.state.drop.policyId}</p>
              </div>
              <div className="flex items-center gap-3">
                {tooMany ? <span className="text-xs text-warning">At most {MAX_BURNS} at a time</span> : null}
                <button className="btn btn-error btn-sm" disabled={selected.length === 0 || tooMany || burning != null} onClick={() => burnDropTokens(drop)}>
                  {burning === drop.state.drop.policyId ? <span className="loading loading-spinner loading-xs" /> : null}
                  Burn {selected.length || ""} selected
                </button>
              </div>
            </div>
            <ul className="flex flex-col divide-y divide-line">
              {drop.assets.map((asset) => {
                const key = assetKey(asset.policyId, asset.name);
                const info = tokens?.info.get(key);
                const image = toIpfsUrl(info?.image);
                const technical = technicalToken(asset.name);
                const name = info?.name || technical?.name || assetNameFromHex(asset.name) || "(no name)";
                return (
                  <li key={key} className="flex items-center gap-3 py-2.5">
                    <input type="checkbox" className="checkbox checkbox-sm" checked={amounts[key] != null} onChange={() => setAmount(key, amounts[key] == null ? `${asset.quantity}` : null)} aria-label={`Select ${name}`} />
                    <div className="size-10 shrink-0 overflow-hidden rounded-field bg-base-300">
                      {image ? <IpfsImage src={image} alt="" width="64" height="64" className="size-10 object-cover" /> : <TokenImagePlaceholder kind={technical?.kind} />}
                    </div>
                    <div className="min-w-0 grow">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <span className="truncate">{name}</span>
                        {technical?.kind === "royalty" ? <span className="shrink-0 rounded-full bg-warning/90 px-2 py-0.5 text-[11px] font-semibold text-warning-content">{technical.badge}</span> : null}
                      </p>
                      {technical ? <p className="truncate text-xs text-base-content/55">{technical.note}</p> : null}
                      <p className="truncate font-mono text-[11px] text-base-content/45">{info?.maFingerprint ?? shortenId(asset.name, 10)}</p>
                    </div>
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
        <summary className="cursor-pointer font-medium">Tokens of a locked or foreign policy: the dead address</summary>
        <div className="mt-3 flex flex-col gap-3 text-base-content/65">
          <p>Tokens of a policy you cannot sign for cannot be burned, only locked away forever. Whatever is sent to this address never comes out again, but the tokens stay in the total supply.</p>
          <p className="break-all font-mono text-xs">{DEAD_ADDRESS}</p>
          <p>
            It is the address of the script <span className="font-mono text-xs">{LOCKED_SCRIPT}</span>, which is only valid before slot 0 and can therefore never spend
            anything. Verify it with <span className="font-mono text-xs">cardano-cli address build --payment-script-file locked_script.json</span>.
          </p>
          <div>
            <ExternalLink href={explorerAddressUrl(DEAD_ADDRESS)}>cexplorer</ExternalLink>
          </div>
        </div>
      </details>
    </div>
  );
}

export default function BurnTokens() {
  return <ConnectWallet message="Connect a wallet to burn tokens of policies signed by your wallet key.">{(wallet) => <Burn wallet={wallet} />}</ConnectWallet>;
}
