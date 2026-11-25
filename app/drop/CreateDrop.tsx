"use client";

import { createDrop, DropCosts, dropCosts } from "@cardano/drop";
import CostTable, { shown } from "@components/CostTable";
import { DropToken, suggestedGroups } from "@cardano/dropScript";
import { isValidAddress } from "@cardano/royalties";
import { answered } from "@cardano/answer";
import { collectionNameError, DESCRIPTION_MAX_LENGTH } from "@cardano/registration";
import { formatAda, shortenId, toIpfsUrl } from "@cardano/utils";
import IpfsImage from "@components/IpfsImage";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { uploadToIpfs } from "@/app/mint/uploadToIpfs";
import TxResult from "@components/TxResult";
import { Field, inputClass, Notice, secondaryButtonClass } from "@components/ui";
import { ConnectedWallet } from "@components/useWallet";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/** ADA a group binds until the drop is closed, and what a buyer leaves with the metadata of a token. Both rounded up. */
const GROUP_DEPOSIT_ADA = 2.1;
const METADATA_DEPOSIT_ADA = 1.5;
/** Fees as they came out on the chain, rounded up: of creating a drop, and of a purchase, which runs the contract. */
const CREATE_FEE_ADA = 0.6;
const BUY_FEE_ADA = 0.45;

const KNOWN_DROPS = "drops";

/** Policy ids of the drops created in this browser, the newest first. */
export function knownDrops(): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(KNOWN_DROPS) ?? "[]");
    return Array.isArray(stored) ? stored.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Sells a list of tokens as a drop: asks for the price and whether tokens can be burned, then creates it.
 * `tokens` is null while the list is empty or has errors.
 */
export function SellAsDrop({ wallet, tokens, step }: { wallet: ConnectedWallet; tokens: DropToken[] | null; step?: number }) {
  const [price, setPrice] = useState("10");
  const [burnable, setBurnable] = useState(false);
  const [royalty, setRoyalty] = useState("0");
  const [royaltyAddress, setRoyaltyAddress] = useState(wallet.changeAddress);
  const [collectionName, setCollectionName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ txHash: string; policyId: string } | null>(null);

  const priceAda = Number(price);
  const priceError = price.trim() === "" || !Number.isFinite(priceAda) || priceAda < 1 ? "At least 1 ADA" : undefined;
  // how many purchases can run side by side is a technical choice the site makes from the size of the list
  const groupCount = tokens ? suggestedGroups(tokens.length) : 0;
  const royaltyPercent = Number(royalty);
  const royaltyError = royalty.trim() === "" || !Number.isFinite(royaltyPercent) || royaltyPercent < 0 || royaltyPercent > 100 ? "0 to 100" : undefined;
  const withRoyalty = !royaltyError && royaltyPercent > 0;
  const royaltyAddressError = withRoyalty && !isValidAddress(royaltyAddress) ? "Not a valid address" : undefined;
  // description and picture belong to a collection, which is known by its name
  const nameError = collectionName.trim() ? collectionNameError(collectionName) : description.trim() || image ? "Needs a name" : undefined;
  const collection = useMemo(
    () => (collectionName.trim() && !collectionNameError(collectionName) ? { name: collectionName, description, image } : undefined),
    [collectionName, description, image]
  );
  const ready = tokens != null && !priceError && !royaltyError && !royaltyAddressError && !nameError && !uploading && !busy;

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

  // what creating costs, read from the transaction as it would be built; a rough figure stands in until then or if that fails
  const [costs, setCosts] = useState<DropCosts | null>(null);
  const royaltyTarget = withRoyalty && !royaltyAddressError ? royaltyAddress.trim() : null;
  useEffect(() => {
    let cancelled = false;
    // waits for a pause in typing, the transaction is put together for it
    const timer = setTimeout(() => {
      (tokens && !priceError
        ? dropCosts(wallet.connection, { tokens, groups: groupCount, price: BigInt(Math.round(priceAda * 1_000_000)), burnable, collection }, royaltyTarget ? { percent: royaltyPercent, address: royaltyTarget } : undefined)
        : Promise.resolve(null)
      )
        .catch(() => null)
        .then((found) => {
          if (!cancelled) setCosts(found);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wallet.connection, tokens, groupCount, priceAda, priceError, burnable, royaltyPercent, royaltyTarget, collection]);
  const deposit = costs?.deposit ?? Math.round(groupCount * GROUP_DEPOSIT_ADA * 1_000_000);
  const fee = costs?.fee ?? CREATE_FEE_ADA * 1_000_000;

  const create = async () => {
    if (!tokens) return;
    const lovelace = BigInt(Math.round(priceAda * 1_000_000));
    if (
      !confirm(
        `Create a drop of ${tokens.length} tokens for ${formatAda(Number(lovelace))} each?\n\n${collection ? `Collection: ${collection.name.trim()}.\n\n` : ""}${withRoyalty ? `Royalties: ${royaltyPercent} %.\n\n` : ""}The list, the price, the name of the collection, the royalties and whether tokens can be burned cannot be changed afterwards. You can close the drop at any time.`
      )
    )
      return;
    setBusy(true);
    try {
      const created = await createDrop(wallet.connection, { tokens, groups: groupCount, price: lovelace, burnable, collection }, withRoyalty ? { percent: royaltyPercent, address: royaltyAddress.trim() } : undefined);
      localStorage.setItem(KNOWN_DROPS, JSON.stringify([created.policyId, ...knownDrops().filter((known) => known !== created.policyId)]));
      setResult(created);
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <TxResult title="Drop created" txHashes={[result.txHash]} onReset={() => setResult(null)} resetLabel="Back to the form">
        <p className="text-sm text-base-content/65">
          Once the transaction is confirmed, this is the page your buyers buy on:{" "}
          <Link className="link link-primary break-all" href={`/drop/${result.policyId}`}>
            cardano-tools.io/drop/{result.policyId}
          </Link>
        </p>
      </TxResult>
    );
  }

  return (
    <div className="surface flex flex-col gap-6 p-6">
      {step ? (
        <h3 className="flex items-center gap-3 text-base font-semibold tracking-tight">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{step}</span>
          Price and sale
        </h3>
      ) : null}
      <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)_auto]">
        <Field label="Collection name (optional)" error={nameError} hint="Written on chain with the drop. Cannot be changed later.">
          <input className={inputClass} value={collectionName} onChange={(event) => setCollectionName(event.target.value)} placeholder="My collection" />
        </Field>
        <Field label="About the collection (optional)">
          <input className={inputClass} value={description} maxLength={DESCRIPTION_MAX_LENGTH} onChange={(event) => setDescription(event.target.value)} placeholder="24 robots, drawn by hand" />
        </Field>
        <Field label="Picture (optional)" error={imageError}>
          <span className="flex items-center gap-2">
            {image ? <IpfsImage width="40" height="40" className="size-10 shrink-0 rounded-field object-cover" src={toIpfsUrl(image)} alt="Collection picture" unoptimized /> : null}
            <label className={`${secondaryButtonClass} h-10 ${uploading ? "btn-disabled" : ""}`}>
              {uploading ? <span className="loading loading-spinner loading-xs" /> : <ArrowUpTrayIcon className="size-4" />}
              {image ? "Change" : "Choose picture"}
              <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(event) => upload(event.target.files?.[0])} />
            </label>
            {image ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setImage("")}>
                Remove
              </button>
            ) : null}
          </span>
        </Field>
      </div>

      <Field label="Price per token in ADA" error={priceError} hint="Goes to your wallet with every purchase" className="sm:max-w-xs">
        <input className={inputClass} inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <Field label="Royalties in %" error={royaltyError} hint="Your share when a token is resold on a marketplace. 0 for none. Cannot be changed later.">
          <input className={inputClass} inputMode="decimal" value={royalty} onChange={(event) => setRoyalty(event.target.value)} />
        </Field>
        {withRoyalty ? (
          <Field label="Address receiving the royalties" error={royaltyAddressError}>
            <input className={`${inputClass} font-mono text-[13px]`} value={royaltyAddress} onChange={(event) => setRoyaltyAddress(event.target.value)} />
          </Field>
        ) : null}
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="checkbox checkbox-sm mt-0.5" checked={burnable} onChange={(event) => setBurnable(event.target.checked)} />
        <span className="text-sm">
          Buyers may burn their tokens
          <span className="block text-xs text-base-content/55">
            A burned token is gone for good and cannot be bought again. Its owner gets back the about {METADATA_DEPOSIT_ADA} ADA that stay with the metadata. Cannot
            be changed later.
          </span>
        </span>
      </label>

      <Notice>Nothing is minted now. A token is minted when somebody buys it, and the buyer pays for it. Tokens nobody bought never exist.</Notice>

      {tokens ? (
        <div className="grid gap-6 sm:grid-cols-2">
          <CostTable
            title="Creating the drop"
            rows={[
              { label: `Deposit for ${groupCount} group${groupCount === 1 ? "" : "s"}`, hint: "back when you close", lovelace: deposit, about: !costs },
              { label: "Transaction fee", lovelace: fee, about: !costs },
              { label: "Leaves your wallet", lovelace: shown(deposit) + shown(fee), sum: true, about: !costs },
            ]}
          />
          {!priceError ? (
            <CostTable
              title="A buyer pays per token"
              rows={[
                { label: "Your price", hint: "goes to you", lovelace: Math.round(priceAda * 1_000_000) },
                { label: "Deposit for the metadata", hint: burnable ? "back when burned" : undefined, lovelace: METADATA_DEPOSIT_ADA * 1_000_000, about: true },
                { label: "Transaction fee", lovelace: BUY_FEE_ADA * 1_000_000, about: true },
                { label: "Leaves the buyer's wallet", lovelace: Math.round((priceAda + METADATA_DEPOSIT_ADA + BUY_FEE_ADA) * 1_000_000), sum: true, about: true },
              ]}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-4">
        <button className="btn btn-primary" disabled={!ready} onClick={create}>
          {busy ? <span className="loading loading-spinner loading-sm" /> : null}
          Create drop
        </button>
        <span className="text-xs text-base-content/45">Seller: {shortenId(wallet.changeAddress, 10)}</span>
      </div>
    </div>
  );
}

/** The drops created in this browser and a field to open any other by its policy id. */
export function YourDrops() {
  const [policyId, setPolicyId] = useState("");
  const [known, setKnown] = useState<string[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => setKnown(knownDrops()), 0);
    return () => clearTimeout(timer);
  }, []);
  const valid = /^[0-9a-f]{56}$/.test(policyId.trim());

  return (
    <div className="surface flex flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold tracking-tight">Your drops</h2>
      {known.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {known.map((id) => (
            <li key={id}>
              <Link className="link link-primary break-all font-mono text-[13px]" href={`/drop/${id}`}>
                {id}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-base-content/55">Drops you create in this browser are listed here.</p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Open a drop by its policy id" className="grow">
          <input className={`${inputClass} font-mono text-[13px]`} value={policyId} onChange={(event) => setPolicyId(event.target.value)} />
        </Field>
        <Link className={`btn btn-primary ${valid ? "" : "btn-disabled"}`} href={valid ? `/drop/${policyId.trim()}` : "#"} aria-disabled={!valid}>
          Open
        </Link>
      </div>
    </div>
  );
}
