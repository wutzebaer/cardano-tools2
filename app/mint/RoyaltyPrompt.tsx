"use client";

import { watchConfirmation } from "@cardano/confirmation";
import { getPolicyCollection, getPolicyRoyalties, getTokenSearch } from "@cardano/dbsync";
import { policySecondsLeft } from "@cardano/mint";
import { explorerTxUrl } from "@cardano/network";
import { answered } from "@cardano/answer";
import { collectionNameError, DESCRIPTION_MAX_LENGTH } from "@cardano/registration";
import { isValidAddress, mintRoyaltyToken } from "@cardano/royalties";
import { MintPolicy } from "@cardano/types";
import { formatNumber, toIpfsUrl } from "@cardano/utils";
import IpfsImage from "@components/IpfsImage";
import { ExternalLink, Field, inputClass, secondaryButtonClass } from "@components/ui";
import { ConnectedWallet } from "@components/useWallet";
import { ArrowUpTrayIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { uploadToIpfs } from "@/app/mint/uploadToIpfs";
import { useEffect, useState } from "react";

type Royalties = Awaited<ReturnType<typeof getPolicyRoyalties>>;

/**
 * The royalties and the collection name of a policy, inside the box of the policy: what they are, or the form to set
 * them as long as it has none. Both travel with the royalty token, the name as a CIP-88 registration. Marketplaces only honour a royalty token that is the very first token of its policy, so the form is open for a
 * policy that has not minted yet and folded away, with a warning, for one that has. Give it a `key` per policy.
 */
export default function RoyaltyPrompt({ wallet, policy, minted }: { wallet: ConnectedWallet; policy: MintPolicy; minted: boolean }) {
  const [percent, setPercent] = useState("5");
  const [address, setAddress] = useState(wallet.changeAddress);
  const [collectionName, setCollectionName] = useState(policy.name ?? "");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string>();
  const [registered, setRegistered] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  /** undefined while the chain is asked */
  const [royalties, setRoyalties] = useState<Royalties | undefined>(undefined);
  /** imported policies are not found through the wallet, so the chain is asked whether the policy already has tokens */
  const [foundTokens, setFoundTokens] = useState(false);
  const [opened, setOpened] = useState(false);

  useEffect(() => (txHash ? watchConfirmation(txHash, () => setConfirmed(true)) : undefined), [txHash]);

  useEffect(() => {
    let cancelled = false;
    getPolicyRoyalties(policy.policyId).then((found) => {
      if (!cancelled) setRoyalties(found);
    });
    getPolicyCollection(policy.policyId).then((found) => {
      if (!cancelled) setRegistered(found?.name ?? null);
    });
    if (!minted) {
      getTokenSearch(policy.policyId)
        .then((tokens) => tokens.length > 0)
        .catch(() => false)
        .then((hasTokens) => {
          if (!cancelled) setFoundTokens(hasTokens);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [policy.policyId, minted]);

  if (txHash) {
    return (
      <div className="flex flex-col gap-2 rounded-field border border-line bg-base-200 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        {confirmed ? (
          <span className="flex items-center gap-2 text-success">
            <CheckCircleIcon className="size-4" />
            Royalty token confirmed, mint your tokens now.
          </span>
        ) : (
          <span className="flex items-center gap-2 text-base-content/65">
            <span className="loading loading-spinner loading-xs" />
            Royalty token submitted. Wait for the confirmation before you mint, it has to be the first token of the policy.
          </span>
        )}
        <ExternalLink href={explorerTxUrl(txHash)}>cexplorer</ExternalLink>
      </div>
    );
  }

  if (royalties === undefined) return null;

  if (royalties) {
    const rate = Number(royalties.rate);
    return (
      <p className="text-sm text-base-content/65">
        {registered ? (
          <>
            Collection: <span className="text-base-content">{registered}</span>
            {" · "}
          </>
        ) : null}
        Royalties: {Number.isFinite(rate) ? `${formatNumber(rate * 100)} %` : royalties.rate}
        {royalties.address ? (
          <>
            {" to "}
            <span className="break-all font-mono text-xs">{royalties.address}</span>
          </>
        ) : null}
      </p>
    );
  }

  // after the lock date nothing can be minted under the policy, the royalty token neither
  if (policySecondsLeft(policy) <= 0) return <p className="text-sm text-base-content/55">No royalties. The policy is locked, they cannot be set any more.</p>;

  const hasTokens = minted || foundTokens;

  if (hasTokens && !opened) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-base-content/55">This policy has no royalties.</p>
        <button type="button" className={secondaryButtonClass} onClick={() => setOpened(true)}>
          Set royalties
        </button>
      </div>
    );
  }

  const rate = Number(percent);
  const rateValid = percent.trim() !== "" && rate >= 0 && rate <= 100;
  const addressValid = isValidAddress(address);
  // description and picture belong to a collection, which is known by its name
  const nameError = collectionName.trim() ? collectionNameError(collectionName) : description.trim() || image ? "Needs a name" : undefined;

  const upload = async (file: File | undefined) => {
    setImageError(undefined);
    if (!file) return;
    setUploading(true);
    try {
      setImage(`ipfs://${await answered(uploadToIpfs(file))}`);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "The upload to IPFS failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const mint = async () => {
    setMinting(true);
    try {
      setTxHash(await mintRoyaltyToken(wallet.connection, policy, rate, address, wallet.keyHashes, { name: collectionName, description, image }));
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-l-2 border-warning/60 pl-4">
      <p className="text-sm text-warning">
        {hasTokens
          ? "This policy has already minted tokens. Marketplaces that follow CIP-27 strictly ignore a royalty token that is not the first token of its policy. You can mint it anyway, for royalties that count everywhere create a new policy."
          : "Should sales of this policy's NFTs pay royalties? Then mint the royalty token before anything else: marketplaces only honour it as the very first token of a policy. It also puts the collection's name, description and picture on chain."}
      </p>
      <div className="grid gap-3 sm:grid-cols-[14rem_8rem_minmax(0,1fr)]">
        <Field label="Collection name (optional)" error={nameError}>
          <input className={inputClass} value={collectionName} onChange={(e) => setCollectionName(e.target.value)} placeholder="My collection" />
        </Field>
        <Field label="Royalties in %" error={rateValid ? undefined : "0 to 100"}>
          <input className={inputClass} type="number" min="0" max="100" step="0.5" value={percent} onChange={(e) => setPercent(e.target.value)} />
        </Field>
        <Field label="Address receiving the royalties" error={addressValid ? undefined : "Not a valid address"}>
          <input className={`${inputClass} font-mono text-xs`} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="addr1…" />
        </Field>
      </div>
      <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Field label="About the collection (optional)">
          <input className={inputClass} value={description} maxLength={DESCRIPTION_MAX_LENGTH} onChange={(e) => setDescription(e.target.value)} placeholder="24 robots, drawn by hand" />
        </Field>
        <Field label="Picture (optional)" error={imageError}>
          <span className="flex items-center gap-2">
            {image ? <IpfsImage width="40" height="40" className="size-10 shrink-0 rounded-field object-cover" src={toIpfsUrl(image)} alt="Collection picture" unoptimized /> : null}
            <label className={`${secondaryButtonClass} h-10 ${uploading ? "btn-disabled" : ""}`}>
              {uploading ? <span className="loading loading-spinner loading-xs" /> : <ArrowUpTrayIcon className="size-4" />}
              {image ? "Change" : "Choose picture"}
              <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => upload(e.target.files?.[0])} />
            </label>
            {image ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImage("")}>
                Remove
              </button>
            ) : null}
          </span>
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary btn-sm" disabled={!rateValid || !addressValid || !!nameError || uploading || minting} onClick={mint}>
          {minting ? <span className="loading loading-spinner loading-xs" /> : null}
          Mint royalty token
        </button>
        {hasTokens ? (
          <button type="button" className="btn btn-ghost btn-sm" disabled={minting} onClick={() => setOpened(false)}>
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
