"use client";

import { SellAsDrop, YourDrops } from "@/app/drop/CreateDrop";
import DropTokenEditor from "@/app/drop/DropTokenEditor";
import { DropToken } from "@cardano/dropScript";
import { assetNameFor, tokensFromMetadata } from "@cardano/metadata";
import { MintCosts, mintCosts, mintedAssetNameHex, MintFormat, MintProgress, mintTokens, PartialMintError } from "@cardano/mint";
import CostTable, { shown } from "@components/CostTable";
import { formatAda } from "@cardano/utils";
import { explorerPolicyUrl, IS_MAINNET } from "@cardano/network";
import { MintPolicy, MintToken } from "@cardano/types";
import ConnectWallet from "@components/ConnectWallet";
import TxResult from "@components/TxResult";
import { ExternalLink, Notice, secondaryButtonClass } from "@components/ui";
import { ConnectedWallet } from "@components/useWallet";
import { CodeBracketIcon, ExclamationTriangleIcon, MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useEffect, useMemo, useState } from "react";
import MetadataEditor from "./MetadataEditor";
import PolicySelector from "./PolicySelector";
import RoyaltyPrompt, { RoyaltyStatus } from "./RoyaltyPrompt";
import TokenForm, { tokenErrors } from "./TokenForm";
import { usePolicies } from "./usePolicies";

interface MintResult {
  txHashes: string[];
  policy: MintPolicy;
  /** The tokens that were minted */
  tokens: MintToken[];
  format: MintFormat;
  /** Set when a mint of several transactions stopped on the way: how many tokens it left out, and why */
  stopped?: { left: number; reason: string };
}

/** Tokens listed with their link after a mint, a long list is cut there. */
const LISTED_TOKENS = 50;

function newFungible(name: string): MintToken {
  return {
    id: crypto.randomUUID(),
    standard: 333,
    assetName: assetNameFor(name),
    amount: "1",
    name,
    description: "",
    image: "",
    mediaType: "",
    ticker: "",
    url: "",
    decimals: "",
    files: [],
    properties: [],
    extra: {},
  };
}

const numberedName = (index: number) => `Token${String(index).padStart(3, "0")}`;

function Minted({ result, onReset }: { result: MintResult; onReset: () => void }) {
  return (
    <TxResult title={result.stopped ? "Mint stopped on the way" : "Mint submitted"} txHashes={result.txHashes} onReset={onReset} resetLabel="Mint more">
      {result.stopped ? (
        <Notice tone="warning">
          {result.tokens.length} token{result.tokens.length === 1 ? " is" : "s are"} minted, {result.stopped.left} {result.stopped.left === 1 ? "is" : "are"} not: {result.stopped.reason} Mint only the
          missing ones next time, a token minted twice exists twice.
        </Notice>
      ) : null}
      <ul className="flex flex-col gap-1 text-sm">
        {result.tokens.slice(0, LISTED_TOKENS).map((token) => (
          <li key={token.id}>
            <ExternalLink
              href={IS_MAINNET ? `https://pool.pm/${result.policy.policyId}.${mintedAssetNameHex(token, result.format)}` : explorerPolicyUrl(result.policy.policyId)}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {token.name || token.assetName}
            </ExternalLink>
          </li>
        ))}
        {result.tokens.length > LISTED_TOKENS ? <li className="text-base-content/55">and {(result.tokens.length - LISTED_TOKENS).toLocaleString("en")} more</li> : null}
      </ul>
    </TxResult>
  );
}

/** The policy to mint under and the button that mints. `tokens` is null while there is nothing valid to mint. */
function MintNow(props: { wallet: ConnectedWallet; tokens: MintToken[] | null; summary: string; disabled?: boolean; onMinted: (result: MintResult) => void }) {
  const selection = usePolicies(props.wallet);
  return (
    <>
      <PolicyChoice wallet={props.wallet} selection={selection} />
      <MintButton {...props} selection={selection} />
    </>
  );
}

type Policies = ReturnType<typeof usePolicies>;

function PolicyChoice({ wallet, selection, step, onRoyaltyStatus }: { wallet: ConnectedWallet; selection: Policies; step?: number; onRoyaltyStatus?: (status: RoyaltyStatus) => void }) {
  const policy = selection.selected;
  return (
    <>
      <PolicySelector keyHash={wallet.keyHash} selection={selection} step={step}>
        {policy && !selection.loading ? <RoyaltyPrompt key={policy.policyId} wallet={wallet} policy={policy} minted={selection.minted.has(policy.policyId)} onStatus={onRoyaltyStatus} /> : null}
      </PolicySelector>
    </>
  );
}

/** Said at the mint button, where the decision is made: the first mint of a policy settles whether its royalties count everywhere. */
const ROYALTY_WARNINGS: Record<RoyaltyStatus, string | null> = {
  open: "No royalty token yet. It has to be the first token of the policy: set royalties under “Policy” before you mint, afterwards it is too late.",
  pending: "The royalty token is not confirmed yet. Wait for it before you mint.",
  settled: null,
};

/** How the metadata of NFTs is stored, with what speaks for and against each. The site itself offers no page to change metadata. */
const FORMATS: { format: MintFormat; title: string; pros: string[]; cons: string[] }[] = [
  {
    format: "cip68",
    title: "CIP-68 · readable by smart contracts",
    pros: ["Metadata can still be changed while the policy is open", "Smart contracts can read it"],
    cons: ["A deposit of about 2 ₳ per token, back when you burn it"],
  },
  {
    format: "cip25",
    title: "CIP-25 · less ADA bound",
    pros: ["Costs only the fee", "The format every wallet and marketplace has known longest"],
    cons: ["Metadata is fixed with the mint", "Smart contracts cannot read it"],
  },
];

/** `formats` lets the user choose how the metadata is stored, which is a choice for NFTs only. */
function MintButton({ wallet, selection, tokens, summary, disabled, royaltyStatus = "settled", formats, step, onMinted }: { wallet: ConnectedWallet; selection: Policies; tokens: MintToken[] | null; summary: string; disabled?: boolean; royaltyStatus?: RoyaltyStatus; formats?: boolean; step?: number; onMinted: (result: MintResult) => void }) {
  const policy = selection.selected;
  const [minting, setMinting] = useState(false);
  const [progress, setProgress] = useState<MintProgress | null>(null);
  const [format, setFormat] = useState<MintFormat>("cip68");
  const royaltyWarning = ROYALTY_WARNINGS[royaltyStatus];
  // said before the wallet does: it shows the deposit as spent, which surprises those who expect only a fee
  const [costs, setCosts] = useState<MintCosts | null>(null);
  useEffect(() => {
    let cancelled = false;
    // waits for a pause in typing, the transaction is put together for it
    const timer = setTimeout(() => {
      (policy && tokens?.length ? mintCosts(wallet.connection, policy, tokens, wallet.keyHashes, format) : Promise.resolve(null))
        .catch(() => null)
        .then((found) => {
          if (!cancelled) setCosts(found);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [policy, tokens, wallet.connection, wallet.keyHashes, format]);
  const short = costs != null && costs.held < costs.needed;

  const mint = async () => {
    if (!policy || !tokens) return;
    setMinting(true);
    try {
      onMinted({ txHashes: await mintTokens(wallet.connection, policy, tokens, wallet.keyHashes, format, setProgress), policy, tokens, format });
    } catch (error) {
      // what is minted is shown as minted, so that nobody mints it a second time
      if (!(error instanceof PartialMintError)) throw error;
      onMinted({ txHashes: error.txHashes, policy, tokens: error.minted, format, stopped: { left: tokens.length - error.minted.length, reason: error.message } });
    } finally {
      setMinting(false);
      setProgress(null);
    }
  };

  return (
    <>
      <div className="surface flex flex-col gap-3 p-5">
        {step ? (
          <h3 className="flex items-center gap-3 text-base font-semibold tracking-tight">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{step}</span>
            Mint
          </h3>
        ) : null}
        {policy && royaltyWarning ? (
          <p className="flex items-start gap-2 border-l-2 border-warning/60 pl-3 text-sm text-warning">
            <ExclamationTriangleIcon className="mt-0.5 size-4 shrink-0" />
            {royaltyWarning}
          </p>
        ) : null}
        {formats ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {FORMATS.map((option) => (
              <button
                key={option.format}
                type="button"
                className={`flex flex-col gap-2 rounded-field border p-4 text-left transition-colors ${format === option.format ? "border-primary bg-primary/10" : "border-line bg-base-200 hover:border-line-strong"}`}
                onClick={() => setFormat(option.format)}
                aria-pressed={format === option.format}
              >
                <span className="flex items-center gap-2 font-semibold">
                  <span className={`size-3 rounded-full border ${format === option.format ? "border-primary bg-primary" : "border-base-content/40"}`} />
                  {option.title}
                </span>
                <ul className="flex flex-col gap-1 text-sm text-base-content/65">
                  {option.pros.map((text) => (
                    <li key={text} className="flex items-start gap-2">
                      <PlusIcon className="mt-0.5 size-4 shrink-0 text-success" />
                      {text}
                    </li>
                  ))}
                  {option.cons.map((text) => (
                    <li key={text} className="flex items-start gap-2">
                      <MinusIcon className="mt-0.5 size-4 shrink-0 text-warning" />
                      {text}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex grow flex-col gap-2 text-sm text-base-content/55">
            <p>
              {summary}
              {costs && costs.transactions > 1 ? ` They take ${costs.transactions} transactions, which you sign one after another.` : ""}
            </p>
            {costs ? (
              <CostTable
                rows={[
                  ...(costs.deposit > 0 ? [{ label: "Deposit for the metadata", hint: "back when you burn", lovelace: costs.deposit }] : []),
                  { label: costs.transactions > 1 ? `Fees of ${costs.transactions} transactions` : "Transaction fee", lovelace: costs.fee, about: true },
                  { label: "Leaves your wallet", lovelace: shown(costs.deposit) + shown(costs.fee), sum: true },
                  { label: "Minimum ADA beside your tokens", hint: "stays yours", lovelace: costs.kept },
                  {
                    label: "Your wallet needs",
                    hint: short ? `it holds ${formatAda(costs.held)}` : undefined,
                    lovelace: shown(costs.deposit) + shown(costs.fee) + shown(costs.kept),
                    sum: true,
                    tone: short ? "error" : undefined,
                  },
                ]}
              />
            ) : (
              <p>Your wallet shows the fee before signing.</p>
            )}
          </div>
          <button className="btn btn-primary" disabled={!tokens || !policy || minting || disabled} onClick={mint}>
            {minting ? <span className="loading loading-spinner loading-sm" /> : null}
            {progress && progress.batches > 1 ? (progress.state === "signing" ? `Sign ${progress.batch} of ${progress.batches}` : `Waiting for ${progress.batch} of ${progress.batches}`) : "Mint"}
          </button>
        </div>
      </div>
    </>
  );
}

type Target = "mint" | "drop";

const TARGETS: { target: Target; title: string; text: string }[] = [
  { target: "mint", title: "Mint now", text: "All tokens are minted into your wallet with this transaction. You pay the fees and decide later what to do with them." },
  { target: "drop", title: "Sell as a drop", text: "Nothing is minted now. Buyers pick a token on a page of its own and pay for the mint, tokens nobody buys never exist." },
];

/** NFTs are put together once, then either minted right away or put up for sale as a drop. */
function Nfts({ wallet }: { wallet: ConnectedWallet }) {
  const [tokens, setTokens] = useState<DropToken[] | null>(null);
  const [target, setTarget] = useState<Target>("mint");
  const [result, setResult] = useState<MintResult | null>(null);
  const selection = usePolicies(wallet);
  const [royaltyStatus, setRoyaltyStatus] = useState<RoyaltyStatus>("settled");
  const [lastStep, setLastStep] = useState<number>();

  // the mint transaction takes the tokens in the form of the mint page
  const mintTokensList = useMemo(
    () => (tokens ? tokensFromMetadata(Object.fromEntries(tokens.map((token) => [token.assetName, token.metadata])), []).map((token) => ({ ...token, standard: 222 as const, amount: "1" })) : null),
    [tokens]
  );

  if (result) return <Minted result={result} onReset={() => setResult(null)} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="surface flex flex-col gap-4 p-5">
      <h2 className="flex items-center gap-3 text-base font-semibold tracking-tight">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">1</span>
        What do you want to do?
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {TARGETS.map((option) => (
          <button
            key={option.target}
            type="button"
            className={`flex flex-col gap-1 rounded-field border p-4 text-left transition-colors ${target === option.target ? "border-primary bg-primary/10" : "border-line bg-base-200 hover:border-line-strong"}`}
            onClick={() => setTarget(option.target)}
            aria-pressed={target === option.target}
          >
            <span className="flex items-center gap-2 font-semibold">
              <span className={`size-3 rounded-full border ${target === option.target ? "border-primary bg-primary" : "border-base-content/40"}`} />
              {option.title}
            </span>
            <span className="text-sm text-base-content/55">{option.text}</span>
          </button>
        ))}
      </div>
      </div>

      {target === "mint" ? <PolicyChoice wallet={wallet} selection={selection} step={2} onRoyaltyStatus={setRoyaltyStatus} /> : null}

      <div className="surface p-6">
        <DropTokenEditor onChange={setTokens} firstStep={target === "mint" ? 3 : 2} onNextStep={setLastStep} />
      </div>

      {target === "mint" ? (
        <MintButton
          wallet={wallet}
          selection={selection}
          tokens={mintTokensList}
          summary={tokens ? `Mints ${tokens.length} NFT${tokens.length === 1 ? "" : "s"} into your wallet.` : "Add the tokens above first."}
          royaltyStatus={royaltyStatus}
          formats
          step={lastStep}
          onMinted={setResult}
        />
      ) : (
        <SellAsDrop wallet={wallet} tokens={tokens} step={lastStep} />
      )}
    </div>
  );
}

/** Fungible tokens have fields of their own (ticker, decimals, amount), they keep the form they had. */
function Fungible({ wallet }: { wallet: ConnectedWallet }) {
  const [tokens, setTokens] = useState<MintToken[]>(() => [newFungible(numberedName(1))]);
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<MintResult | null>(null);

  const valid = tokens.length > 0 && tokens.every((token) => Object.keys(tokenErrors(token, tokens)).length === 0);

  if (result) {
    return (
      <Minted
        result={result}
        onReset={() => {
          setResult(null);
          setTokens([newFungible(numberedName(1))]);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {editing ? (
        <MetadataEditor tokens={tokens} onApply={(applied) => setTokens(applied.map((token) => ({ ...token, standard: 333 })))} onClose={() => setEditing(false)} />
      ) : (
        <div className="flex flex-col gap-4">
          {tokens.map((token) => (
            <TokenForm
              key={token.id}
              token={token}
              allTokens={tokens}
              fungibleOnly
              onChange={(changed) => setTokens(tokens.map((t) => (t.id === changed.id ? changed : t)))}
              onRemove={tokens.length > 1 ? () => setTokens(tokens.filter((t) => t.id !== token.id)) : undefined}
            />
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${secondaryButtonClass} w-fit`} onClick={() => setTokens([...tokens, newFungible(numberedName(tokens.length + 1))])}>
              <PlusIcon className="size-4" />
              Add token
            </button>
            <button type="button" className={`${secondaryButtonClass} w-fit`} onClick={() => setEditing(true)}>
              <CodeBracketIcon className="size-4" />
              Edit metadata JSON
            </button>
          </div>
        </div>
      )}

      <MintNow
        wallet={wallet}
        tokens={valid ? tokens : null}
        disabled={editing}
        summary={`Mints ${tokens.length} CIP-68 token${tokens.length === 1 ? "" : "s"} with on-chain metadata.`}
        onMinted={setResult}
      />
    </div>
  );
}

function Mint({ wallet }: { wallet: ConnectedWallet }) {
  const [kind, setKind] = useState<"nft" | "fungible">("nft");
  return (
    <div className="flex flex-col gap-6">
      <div className="join">
        {(["nft", "fungible"] as const).map((option) => (
          <button key={option} type="button" className={`btn btn-sm join-item border-line ${kind === option ? "btn-primary" : "bg-base-300"}`} onClick={() => setKind(option)}>
            {option === "nft" ? "NFTs" : "Fungible token"}
          </button>
        ))}
      </div>
      {kind === "nft" ? <Nfts wallet={wallet} /> : <Fungible wallet={wallet} />}
      <YourDrops />
    </div>
  );
}

export default function MintForm() {
  return <ConnectWallet message="Connect a wallet to mint tokens or to sell them as a drop.">{(wallet) => <Mint wallet={wallet} />}</ConnectWallet>;
}
