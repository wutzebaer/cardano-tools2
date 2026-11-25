"use client";

import { watchConfirmation } from "@cardano/confirmation";
import { buyToken, closeGroups, DropState, loadDrop, loadDropTokens, tokenStatus } from "@cardano/drop";
import { DropToken } from "@cardano/dropScript";
import { explorerPolicyUrl, explorerTxUrl } from "@cardano/network";
import { errorToMessage, formatAda, shortenId, toIpfsUrl } from "@cardano/utils";
import CopyButton from "@components/CopyButton";
import IpfsImage from "@components/IpfsImage";
import SupportNote from "@components/SupportNote";
import TokenImagePlaceholder from "@components/TokenImagePlaceholder";
import TxResult from "@components/TxResult";
import { ExternalLink, inputClass, Notice, secondaryButtonClass } from "@components/ui";
import { useWallet } from "@components/useWallet";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

const PAGE = 48;

/** What a buyer pays on top of the price, rounded up: the transaction fee and the deposit that stays with the metadata. */
const BUYER_EXTRA_ADA = 2;

type Loaded = { state: DropState; tokens: DropToken[] } | { missing: true } | { error: string };

function imageOf(token: DropToken) {
  const image = token.metadata.image;
  return typeof image === "string" || Array.isArray(image) ? toIpfsUrl(image as string | string[]) : "";
}

export default function DropView({ policyId }: { policyId: string }) {
  const { wallet, connect, connecting } = useWallet();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ title: string; txHash: string; bought?: DropToken } | null>(null);
  const [confirmedTx, setConfirmedTx] = useState<string>();
  // bought here a moment ago: sold, although the chain data may not say so yet
  const [justBought, setJustBought] = useState<number[]>([]);
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const state = await loadDrop(policyId);
      if (!state) return { missing: true as const };
      return { state, tokens: await loadDropTokens(state.config) };
    })().then(
      (value) => !cancelled && setLoaded(value),
      (error) => !cancelled && setLoaded({ error: errorToMessage(error) })
    );
    return () => {
      cancelled = true;
    };
  }, [policyId, reload]);

  // what is on chain changes with the transaction, not with its submission
  useEffect(() => {
    if (!result) return;
    return watchConfirmation(result.txHash, () => {
      setConfirmedTx(result.txHash);
      setReload((count) => count + 1);
    });
  }, [result]);

  const drop = loaded && "state" in loaded ? loaded : null;
  const statuses = useMemo(
    () =>
      drop
        ? drop.tokens.map((_, index) => {
            const status = tokenStatus(drop.state, index);
            return status === "available" && justBought.includes(index) ? "sold" : status;
          })
        : [],
    [drop, justBought]
  );
  const matching = useMemo(() => {
    if (!drop) return [];
    const wanted = search.trim().toLowerCase();
    return drop.tokens
      .map((token, index) => ({ token, index }))
      .filter(({ token, index }) => (!onlyAvailable || statuses[index] === "available") && (!wanted || `${token.metadata.name} ${token.assetName}`.toLowerCase().includes(wanted)));
  }, [drop, statuses, search, onlyAvailable]);

  if (!loaded) {
    return (
      <div className="surface flex items-center justify-center p-16">
        <span className="loading loading-spinner" />
      </div>
    );
  }
  if ("missing" in loaded) return <Notice tone="warning">There is no drop with this policy id. If you just created it, wait for the transaction to be confirmed and reload.</Notice>;
  if ("error" in loaded) return <Notice tone="error">{loaded.error}</Notice>;

  const { state, tokens } = loaded;
  const { config } = state;
  const available = statuses.filter((status) => status === "available").length;
  const sold = statuses.filter((status) => status === "sold").length;
  const closed = state.groups.length === 0;
  const isOwner = wallet != null && wallet.keyHashes.includes(config.owner);

  const run = async (key: string, title: string, action: () => Promise<string>, bought?: { token: DropToken; index: number }) => {
    setBusy(key);
    try {
      setResult({ title, txHash: await action(), bought: bought?.token });
      if (bought) {
        setJustBought((indexes) => [...indexes, bought.index]);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setBusy(null);
    }
  };

  const buy = (token: DropToken, index: number) => {
    if (!wallet) return connect();
    if (!confirm(`Buy ${token.metadata.name} for ${formatAda(Number(config.price))}?\n\nOn top come the transaction fee and a deposit for the metadata, together about ${BUYER_EXTRA_ADA} ADA.`)) return;
    return run(`buy ${index}`, `You bought ${token.metadata.name}`, () => buyToken(wallet.connection, policyId, tokens, index), { token, index });
  };

  const close = () => {
    if (!wallet) return;
    if (!confirm(`Close this drop?\n\n${available} tokens are not sold yet and can never be bought after this. The deposits of the groups return to your wallet. This cannot be undone.`)) return;
    return run("close", "Drop closed", async () => {
      const { txHash, left } = await closeGroups(wallet.connection, state);
      if (left > 0) alert(`${left} groups are still open. Press Close drop again once this transaction is confirmed.`);
      return txHash;
    });
  };

  if (result && !result.bought) {
    return <TxResult title={result.title} txHashes={[result.txHash]} onReset={() => setResult(null)} resetLabel="Back to the drop" />;
  }

  const bought = result?.bought;
  const boughtImage = bought ? imageOf(bought) : "";
  const confirmed = result != null && confirmedTx === result.txHash;

  return (
    <div className="flex flex-col gap-6">
      {bought && result ? (
        <div className="surface flex flex-col gap-5 border-primary/40 p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="aspect-square w-full shrink-0 overflow-hidden rounded-field bg-base-300 sm:w-44">
              {boughtImage ? <IpfsImage width="512" height="512" className="aspect-square w-full object-cover object-top" src={boughtImage} alt={`${bought.metadata.name}`} /> : <TokenImagePlaceholder />}
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <div>
                <p className="section-label">{confirmed ? "It is yours" : "On its way to your wallet"}</p>
                <h2 className="text-brand text-2xl font-semibold tracking-tight">{`${bought.metadata.name}`}</h2>
              </div>
              {confirmed ? (
                <p className="flex items-center gap-2 text-sm text-success">
                  <CheckCircleIcon className="size-5" />
                  Minted and in your wallet
                </p>
              ) : (
                <p className="flex items-center gap-2 text-sm text-base-content/65">
                  <span className="loading loading-spinner loading-xs" />
                  Being minted, this takes about a minute
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {available > 0 ? (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setResult(null);
                      grid.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    Pick another one
                  </button>
                ) : null}
                <Link className={secondaryButtonClass} href="/my">
                  My tokens
                </Link>
                <ExternalLink href={explorerTxUrl(result.txHash)}>Transaction</ExternalLink>
              </div>
            </div>
          </div>
          <SupportNote />
        </div>
      ) : null}

      <div className="surface flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <p className="section-label">Price</p>
            <p className="text-xl font-semibold tabular-nums">{formatAda(Number(config.price))}</p>
          </div>
          <div>
            <p className="section-label">Available</p>
            <p className="text-xl font-semibold tabular-nums">
              {available.toLocaleString("en")} <span className="text-sm font-normal text-base-content/55">of {config.total.toLocaleString("en")}</span>
            </p>
          </div>
          <div>
            <p className="section-label">Sold</p>
            <p className="text-xl font-semibold tabular-nums">{sold.toLocaleString("en")}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="font-mono text-xs text-base-content/55">{shortenId(policyId, 8)}</span>
            <CopyButton text={policyId}>Copy</CopyButton>
            <ExternalLink href={explorerPolicyUrl(policyId)}>cexplorer</ExternalLink>
          </div>
        </div>
        <p className="text-xs text-base-content/55">
          You also pay the transaction fee and a deposit that stays with the token&apos;s metadata, together about {BUYER_EXTRA_ADA} ADA.{" "}
          {config.burnable ? (
            <>
              Tokens of this drop can be burned by their owner on the{" "}
              <Link className="link" href="/burn">
                Burn
              </Link>{" "}
              page, who then gets that deposit back.
            </>
          ) : (
            "Tokens of this drop cannot be burned."
          )}
        </p>
        {closed ? <Notice tone="warning">This drop is closed, nothing can be bought anymore.</Notice> : null}
        {isOwner && !closed ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <span className="text-sm text-base-content/65">This is your drop.</span>
            <button className="btn btn-sm btn-error btn-outline" disabled={busy != null} onClick={close}>
              {busy === "close" ? <span className="loading loading-spinner loading-xs" /> : null}
              Close drop
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input className={`${inputClass} sm:max-w-xs`} placeholder="Search by name" value={search} onChange={(event) => (setSearch(event.target.value), setShown(PAGE))} />
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" className="checkbox checkbox-sm" checked={onlyAvailable} onChange={(event) => (setOnlyAvailable(event.target.checked), setShown(PAGE))} />
          Only available
        </label>
        <span className="text-xs text-base-content/45 sm:ml-auto">{matching.length.toLocaleString("en")} tokens</span>
      </div>

      <div ref={grid} className="grid scroll-mt-6 grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {matching.slice(0, shown).map(({ token, index }) => {
          const image = imageOf(token);
          const status = statuses[index];
          return (
            <article key={token.assetName} className="surface flex flex-col overflow-hidden">
              <div className="relative aspect-square overflow-hidden bg-base-300">
                {image ? <IpfsImage width="512" height="512" className="aspect-square w-full object-cover object-top" src={image} alt={`${token.metadata.name}`} /> : <TokenImagePlaceholder />}
                {status !== "available" ? (
                  // stamped across the picture: the token stays in its place, so the collection is seen as a whole
                  <span className="absolute inset-0 flex items-center justify-center bg-base-100/60">
                    <span
                      className={`-rotate-12 rounded-md border-[3px] px-4 py-1 text-2xl font-black uppercase tracking-[0.2em] ${status === "sold" ? "border-error text-error" : "border-base-content/60 text-base-content/60"}`}
                    >
                      {status === "sold" ? "Sold" : "Closed"}
                    </span>
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-3 p-4">
                <h3 className="line-clamp-2 min-h-10 text-[15px] font-semibold leading-5 tracking-tight" title={`${token.metadata.name}`}>{`${token.metadata.name}`}</h3>
                <button className="btn btn-primary btn-sm" disabled={status !== "available" || busy != null || connecting} onClick={() => buy(token, index)}>
                  {busy === `buy ${index}` ? <span className="loading loading-spinner loading-xs" /> : null}
                  {status === "available" ? `Buy for ${formatAda(Number(config.price))}` : status === "sold" ? "Sold" : "Not for sale"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {matching.length > shown ? (
        <button className="btn btn-sm self-center border-line bg-base-300" onClick={() => setShown(shown + PAGE)}>
          Show more
        </button>
      ) : null}
      {matching.length === 0 ? <Notice>No token matches.</Notice> : null}
    </div>
  );
}
