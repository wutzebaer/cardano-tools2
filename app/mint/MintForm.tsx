"use client";

import { assetNameFor } from "@cardano/metadata";
import { labeledAssetNameHex, mintTokens } from "@cardano/mint";
import { explorerPolicyUrl, IS_MAINNET } from "@cardano/network";
import { MintPolicy, MintToken } from "@cardano/types";
import ConnectWallet from "@components/ConnectWallet";
import TxResult from "@components/TxResult";
import { ExternalLink, secondaryButtonClass } from "@components/ui";
import { ConnectedWallet } from "@components/useWallet";
import { ArrowUpTrayIcon, CodeBracketIcon, PlusIcon } from "@heroicons/react/24/outline";
import { ChangeEvent, useState } from "react";
import MetadataEditor from "./MetadataEditor";
import PolicySelector from "./PolicySelector";
import RoyaltyPrompt from "./RoyaltyPrompt";
import TokenForm, { MAX_FILE_BYTES, tokenErrors } from "./TokenForm";
import { uploadToIpfs } from "./uploadToIpfs";
import { usePolicies } from "./usePolicies";

interface MintResult {
  txHash: string;
  policy: MintPolicy;
  tokens: MintToken[];
}

function newToken(name: string, patch: Partial<MintToken> = {}): MintToken {
  return {
    id: crypto.randomUUID(),
    standard: 222,
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
    ...patch,
  };
}

const numberedName = (index: number) => `Token${String(index).padStart(3, "0")}`;

function Mint({ wallet }: { wallet: ConnectedWallet }) {
  const selection = usePolicies(wallet);
  const policy = selection.selected;
  const [tokens, setTokens] = useState<MintToken[]>(() => [newToken(numberedName(1))]);
  const [editing, setEditing] = useState(false);
  const [minting, setMinting] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [result, setResult] = useState<MintResult | null>(null);

  const valid = tokens.length > 0 && tokens.every((token) => Object.keys(tokenErrors(token, tokens)).length === 0);

  const mint = async () => {
    if (!policy) return;
    setMinting(true);
    try {
      const txHash = await mintTokens(wallet.connection, policy, tokens, wallet.keyHashes);
      setResult({ txHash, policy, tokens });
      setTokens([newToken(numberedName(1))]);
    } finally {
      setMinting(false);
    }
  };

  /** One NFT per file, named after the file. */
  const addFromFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = "";
    if (files.some((file) => file.size > MAX_FILE_BYTES)) {
      throw new Error("Max 100mb per file");
    }
    try {
      const added: MintToken[] = [];
      for (const [index, file] of files.entries()) {
        setUploading(`Uploading ${index + 1} of ${files.length}`);
        const cid = await uploadToIpfs(file);
        const name = file.name.replace(/\.[^.]*$/, "").slice(0, 60) || numberedName(tokens.length + index + 1);
        added.push(newToken(name, { image: `ipfs://${cid}`, mediaType: file.type }));
      }
      // an untouched placeholder token is replaced instead of minted along
      const untouched = tokens.length === 1 && !tokens[0].image && tokens[0].name === numberedName(1);
      setTokens([...(untouched ? [] : tokens), ...added]);
    } finally {
      setUploading(null);
    }
  };

  if (result) {
    return (
      <TxResult title="Mint submitted" txHashes={[result.txHash]} onReset={() => setResult(null)} resetLabel="Mint more">
        <ul className="flex flex-col gap-1 text-sm">
          {result.tokens.map((token) => (
            <li key={token.id}>
              <ExternalLink href={IS_MAINNET ? `https://pool.pm/${result.policy.policyId}.${labeledAssetNameHex(token.standard, token.assetName)}` : explorerPolicyUrl(result.policy.policyId)} className="inline-flex items-center gap-1 text-primary hover:underline">
                {token.name || token.assetName}
              </ExternalLink>
            </li>
          ))}
        </ul>
      </TxResult>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PolicySelector keyHash={wallet.keyHash} selection={selection} />

      {/* imported policies were made elsewhere and have their tokens already */}
      {policy && !policy.skey && !selection.loading && !selection.minted.has(policy.policyId) ? <RoyaltyPrompt key={policy.policyId} wallet={wallet} policy={policy} /> : null}

      {editing ? (
        <MetadataEditor tokens={tokens} onApply={setTokens} onClose={() => setEditing(false)} />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="section-label">Tokens</p>
          {tokens.map((token) => (
            <TokenForm
              key={token.id}
              token={token}
              allTokens={tokens}
              onChange={(changed) => setTokens(tokens.map((t) => (t.id === changed.id ? changed : t)))}
              onCopyToAll={tokens.length > 1 ? (patch) => setTokens(tokens.map((t) => (t.id === token.id ? t : { ...t, ...patch }))) : undefined}
              onRemove={tokens.length > 1 ? () => setTokens(tokens.filter((t) => t.id !== token.id)) : undefined}
            />
          ))}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`${secondaryButtonClass} w-fit`} onClick={() => setTokens([...tokens, newToken(numberedName(tokens.length + 1))])}>
              <PlusIcon className="size-4" />
              Add token
            </button>
            <label className={`${secondaryButtonClass} w-fit ${uploading ? "btn-disabled" : ""}`}>
              {uploading ? <span className="loading loading-spinner loading-xs" /> : <ArrowUpTrayIcon className="size-4" />}
              {uploading ?? "Add NFTs from files"}
              <input type="file" multiple className="hidden" onChange={addFromFiles} disabled={Boolean(uploading)} />
            </label>
            <button type="button" className={`${secondaryButtonClass} w-fit`} onClick={() => setEditing(true)}>
              <CodeBracketIcon className="size-4" />
              Edit metadata JSON
            </button>          </div>
        </div>
      )}

      <div className="surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-base-content/55">
          Mints {tokens.length} CIP-68 token{tokens.length === 1 ? "" : "s"} plus reference NFTs with on-chain metadata.{" "}
          Your wallet shows the fee before signing.
        </p>
        <button className="btn btn-primary" disabled={!valid || !policy || minting || editing} onClick={mint}>
          {minting ? <span className="loading loading-spinner loading-sm" /> : null}
          Mint
        </button>
      </div>
    </div>
  );
}

export default function MintForm() {
  return <ConnectWallet message="Connect a wallet to mint tokens. The policy is derived from your wallet key.">{(wallet) => <Mint wallet={wallet} />}</ConnectWallet>;
}
