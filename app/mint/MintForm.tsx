"use client";

import { labeledAssetNameHex, mintTokens, paymentKeyHash } from "@cardano/mint";
import { rewardAddressHashToBech32 } from "@cardano/transaction";
import { MintPolicy, MintToken } from "@cardano/types";
import { getSelectedWallet, SelectionMode } from "@cardano/wallet";
import { ApplicationContext } from "@components/StateProvider";
import { ArrowTopRightOnSquareIcon, PlusIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useCallback, useContext, useEffect, useState } from "react";
import PolicySelector from "./PolicySelector";
import TokenForm, { tokenErrors } from "./TokenForm";

interface MintResult {
  txHash: string;
  policy: MintPolicy;
  tokens: MintToken[];
}

function newToken(index: number): MintToken {
  return {
    id: crypto.randomUUID(),
    standard: 222,
    assetName: `Token${String(index).padStart(3, "0")}`,
    amount: "1",
    name: "",
    description: "",
    image: "",
    mediaType: "",
    ticker: "",
    url: "",
    decimals: "",
    properties: [],
  };
}

export default function MintForm() {
  const context = useContext(ApplicationContext);
  const [keyHash, setKeyHash] = useState<string | null>(null);
  const [stakeAddress, setStakeAddress] = useState("");
  const [policy, setPolicy] = useState<MintPolicy | null>(null);
  const [tokens, setTokens] = useState<MintToken[]>([newToken(1)]);
  const [minting, setMinting] = useState(false);
  const [result, setResult] = useState<MintResult | null>(null);

  useEffect(() => {
    const walletInfo = context.state.walletInfo;
    if (!walletInfo) {
      setKeyHash(null);
      setStakeAddress("");
      return;
    }
    walletInfo.enable().then(async (connection) => {
      const [changeAddress, rewardAddresses] = await Promise.all([connection.getChangeAddress(), connection.getRewardAddresses()]);
      setKeyHash(paymentKeyHash(changeAddress));
      setStakeAddress(rewardAddressHashToBech32(rewardAddresses[0]));
    });
  }, [context.state.walletInfo]);

  useEffect(() => {
    setPolicy(null);
  }, [keyHash]);

  const connect = async () => {
    const walletInfo = await getSelectedWallet(SelectionMode.ForceSelectIfNone);
    context.setState({ walletInfo });
  };

  const selectPolicy = useCallback((selected: MintPolicy | null) => setPolicy(selected), []);

  const valid = tokens.length > 0 && tokens.every((token) => Object.keys(tokenErrors(token, tokens)).length === 0);

  const mint = async () => {
    if (!context.state.walletInfo || !policy) return;
    setMinting(true);
    try {
      const connection = await context.state.walletInfo.enable();
      const txHash = await mintTokens(connection, policy, tokens);
      setResult({ txHash, policy, tokens });
      setTokens([newToken(1)]);
    } finally {
      setMinting(false);
    }
  };

  if (!context.state.walletInfo || !keyHash) {
    return (
      <div className="surface flex flex-col items-center gap-4 px-6 py-16 text-center">
        <p className="text-sm text-base-content/55">Connect a wallet to mint tokens. The policy is derived from your wallet key.</p>
        <button className="btn btn-primary" onClick={connect}>
          Connect wallet
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="surface flex flex-col gap-5 p-6">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Transaction submitted</h2>
          <p className="mt-1 text-sm text-base-content/55">Your tokens will show up once the transaction is on-chain.</p>
        </div>
        <p className="break-all font-mono text-[13px]">{result.txHash}</p>
        <ul className="flex flex-col gap-1 text-sm">
          {result.tokens.map((token) => (
            <li key={token.id}>
              <Link
                href={`https://pool.pm/${result.policy.policyId}.${labeledAssetNameHex(token.standard, token.assetName)}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {token.name || token.assetName}
                <ArrowTopRightOnSquareIcon className="size-3.5" />
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Link href={`https://cexplorer.io/tx/${result.txHash}`} target="_blank" className="btn btn-sm gap-2 border-line bg-base-300 hover:border-line-strong">
            cexplorer
            <ArrowTopRightOnSquareIcon className="size-3.5 text-base-content/45" />
          </Link>
          <button className="btn btn-primary btn-sm" onClick={() => setResult(null)}>
            Mint more
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PolicySelector keyHash={keyHash} stakeAddress={stakeAddress} selected={policy} onSelect={selectPolicy} />

      <div className="flex flex-col gap-4">
        <p className="section-label">Tokens</p>
        {tokens.map((token) => (
          <TokenForm
            key={token.id}
            token={token}
            allTokens={tokens}
            onChange={(changed) => setTokens(tokens.map((t) => (t.id === changed.id ? changed : t)))}
            onRemove={tokens.length > 1 ? () => setTokens(tokens.filter((t) => t.id !== token.id)) : undefined}
          />
        ))}
        <button type="button" className="btn btn-sm w-fit gap-1 border-line bg-base-200 hover:border-line-strong" onClick={() => setTokens([...tokens, newToken(tokens.length + 1)])}>
          <PlusIcon className="size-4" />
          Add token
        </button>
      </div>

      <div className="surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-base-content/55">
          Mints {tokens.length} CIP-68 token{tokens.length === 1 ? "" : "s"} plus reference NFTs with on-chain metadata. Your wallet shows the fee before signing.
        </p>
        <button className="btn btn-primary" disabled={!valid || !policy || minting} onClick={mint}>
          {minting ? <span className="loading loading-spinner loading-sm" /> : null}
          Mint
        </button>
      </div>
    </div>
  );
}
