"use client";

import { getTokenSearch } from "@cardano/dbsync";
import { policySecondsLeft } from "@cardano/mint";
import { isValidAddress, mintRoyaltyToken, royaltyMetadata } from "@cardano/royalties";
import ConnectWallet from "@components/ConnectWallet";
import TxResult from "@components/TxResult";
import { ExternalLink, Field, inputClass, Notice } from "@components/ui";
import { ConnectedWallet } from "@components/useWallet";
import { useEffect, useState } from "react";
import PolicySelector from "../mint/PolicySelector";
import { usePolicies } from "../mint/usePolicies";

function Royalties({ wallet }: { wallet: ConnectedWallet }) {
  const selection = usePolicies(wallet);
  const policy = selection.selected;
  const [percent, setPercent] = useState("5");
  const [address, setAddress] = useState(wallet.changeAddress);
  const [minting, setMinting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [checked, setChecked] = useState<{ policyId: string; hasTokens: boolean } | null>(null);

  const policyId = policy?.policyId;
  const knownMinted = policyId != null && selection.minted.has(policyId);

  // imported policies are not found through the wallet, so ask the chain whether the policy already has tokens
  useEffect(() => {
    if (!policyId || knownMinted) return;
    let cancelled = false;
    getTokenSearch(policyId)
      .then((tokens) => tokens.length > 0)
      .catch(() => false)
      .then((hasTokens) => {
        if (!cancelled) setChecked({ policyId, hasTokens });
      });
    return () => {
      cancelled = true;
    };
  }, [policyId, knownMinted]);

  const hasTokens = knownMinted || (checked?.policyId === policyId && checked?.hasTokens);
  const rate = Number(percent);
  const rateValid = percent.trim() !== "" && rate >= 0 && rate <= 100;
  const addressValid = isValidAddress(address);
  const locked = policy != null && policySecondsLeft(policy) <= 0;

  const mint = async () => {
    if (!policy) return;
    setMinting(true);
    try {
      setTxHash(await mintRoyaltyToken(wallet.connection, policy, rate, address, wallet.keyHashes));
    } finally {
      setMinting(false);
    }
  };

  if (txHash) {
    return (
      <TxResult title="Royalty token submitted" txHashes={[txHash]} onReset={() => setTxHash(null)} resetLabel="Done">
        <p className="text-sm text-base-content/65">The policy now carries its royalty definition. You can mint its tokens on the Mint page.</p>
      </TxResult>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Notice>
        Royalties are defined by a token with an empty name and <span className="font-mono">777</span> metadata. Marketplaces only honour it if it is the very first token
        minted with a policy, so create a new policy here before minting anything else with it.{" "}
        <ExternalLink href="https://cips.cardano.org/cip/CIP-27" className="inline-flex items-center gap-1 text-primary hover:underline">
          CIP-27
        </ExternalLink>
      </Notice>

      <PolicySelector keyHash={wallet.keyHash} selection={selection} />

      {hasTokens ? (
        <Notice tone="warning">
          This policy has already minted tokens. Marketplaces that follow CIP-27 strictly ignore a royalty token that is not the first token of its policy. You can mint
          it anyway, for royalties that count everywhere create a new policy.
        </Notice>
      ) : null}

      <div className="surface grid gap-4 p-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field label="Royalties in %" error={rateValid ? undefined : "0 to 100"}>
          <input className={inputClass} type="number" min="0" max="100" step="0.5" value={percent} onChange={(e) => setPercent(e.target.value)} />
        </Field>
        <Field label="Address receiving the royalties" error={addressValid ? undefined : "Not a valid address"}>
          <input className={`${inputClass} font-mono text-xs`} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="addr1…" />
        </Field>
        {rateValid && addressValid ? (
          <pre className="overflow-x-auto rounded-field bg-base-300 p-3 font-mono text-[11px] text-base-content/65 sm:col-span-2">
            {JSON.stringify({ "777": royaltyMetadata(rate, address) }, null, 2)}
          </pre>
        ) : null}
      </div>

      <div className="surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-base-content/55">Mints one royalty token into your wallet. Your wallet shows the fee before signing.</p>
        <button className="btn btn-primary" disabled={!policy || locked || !rateValid || !addressValid || minting} onClick={mint}>
          {minting ? <span className="loading loading-spinner loading-sm" /> : null}
          Mint royalty token
        </button>
      </div>
    </div>
  );
}

export default function RoyaltiesForm() {
  return <ConnectWallet message="Connect a wallet to define royalties for one of your policies.">{(wallet) => <Royalties wallet={wallet} />}</ConnectWallet>;
}
