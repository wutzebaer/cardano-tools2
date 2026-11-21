"use client";

import { assetsInUtxos, WalletAsset } from "@cardano/assets";
import { createRegistryEntry, REGISTRY_LIMITS, REGISTRY_REPOSITORY, RegistryEntry } from "@cardano/registry";
import { walletUtxos } from "@cardano/transaction";
import { MintPolicy } from "@cardano/types";
import { assetNameFromHex, shortenId } from "@cardano/utils";
import ConnectWallet from "@components/ConnectWallet";
import { ExternalLink, Field, inputClass, Notice, secondaryButtonClass, textareaClass } from "@components/ui";
import { ConnectedWallet } from "@components/useWallet";
import { ArrowDownTrayIcon, ClipboardIcon } from "@heroicons/react/24/outline";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import PolicySelector from "../mint/PolicySelector";
import { usePolicies } from "../mint/usePolicies";

const LOGO_SIZE = 256;

/** The registry takes PNG logos up to 64 KB, anything else is scaled down and converted. */
async function toRegistryLogo(file: File): Promise<Uint8Array> {
  if (file.type === "image/png" && file.size <= REGISTRY_LIMITS.logoBytes) {
    return new Uint8Array(await file.arrayBuffer());
  }
  const bitmap = await createImageBitmap(file);
  for (let size = LOGO_SIZE; size >= 32; size /= 2) {
    const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob && blob.size <= REGISTRY_LIMITS.logoBytes) {
      return new Uint8Array(await blob.arrayBuffer());
    }
  }
  throw new Error("Could not scale the logo below 64 KB");
}

function downloadJson(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Register({ wallet }: { wallet: ConnectedWallet }) {
  const selection = usePolicies(wallet);
  const policy: MintPolicy | null = selection.selected;
  const [assets, setAssets] = useState<WalletAsset[]>([]);
  const [assetName, setAssetName] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ticker, setTicker] = useState("");
  const [url, setUrl] = useState("");
  const [decimals, setDecimals] = useState("");
  const [sequenceNumber, setSequenceNumber] = useState("0");
  const [logo, setLogo] = useState<Uint8Array | null>(null);
  const [entry, setEntry] = useState<RegistryEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    walletUtxos(wallet.connection).then((utxos) => {
      if (!cancelled) setAssets(assetsInUtxos(utxos));
    });
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const policyAssets = useMemo(() => assets.filter((asset) => asset.policyId === policy?.policyId), [assets, policy]);

  const errors = {
    assetName: /^([0-9a-f]{2}){0,32}$/.test(assetName) ? undefined : "Hex, at most 32 bytes",
    name: !name.trim() ? "Required" : name.length > REGISTRY_LIMITS.name ? `Max ${REGISTRY_LIMITS.name} characters` : undefined,
    description: !description.trim() ? "Required" : description.length > REGISTRY_LIMITS.description ? `Max ${REGISTRY_LIMITS.description} characters` : undefined,
    ticker: ticker && (ticker.length < REGISTRY_LIMITS.ticker.min || ticker.length > REGISTRY_LIMITS.ticker.max) ? `${REGISTRY_LIMITS.ticker.min} to ${REGISTRY_LIMITS.ticker.max} characters` : undefined,
    url: url && (!url.startsWith("https://") || url.length > REGISTRY_LIMITS.url) ? "https:// URL, max 250 characters" : undefined,
    decimals: decimals && (!/^\d+$/.test(decimals) || Number(decimals) > REGISTRY_LIMITS.decimals) ? `0 to ${REGISTRY_LIMITS.decimals}` : undefined,
    sequenceNumber: /^\d+$/.test(sequenceNumber) ? undefined : "Whole number",
  };
  const valid = Object.values(errors).every((error) => !error);

  const onLogo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setLogo(await toRegistryLogo(file));
  };

  const generate = () => {
    if (!policy) return;
    setEntry(
      createRegistryEntry(
        policy,
        assetName,
        {
          name: name.trim(),
          description: description.trim(),
          ticker: ticker.trim() || undefined,
          url: url.trim() || undefined,
          decimals: decimals ? Number(decimals) : undefined,
          logo: logo ?? undefined,
        },
        Number(sequenceNumber)
      )
    );
  };

  const logoUrl = useMemo(() => (logo ? `data:image/png;base64,${Buffer.from(logo).toString("base64")}` : ""), [logo]);
  const entryJson = entry ? JSON.stringify(entry, null, 2) : "";
  const filename = entry ? `${entry.subject}.json` : "";

  return (
    <div className="flex flex-col gap-6">
      <Notice>
        Registry entries are signed with the policy key itself. Browser wallets cannot produce this signature, so it only works for imported policies whose signing key
        is in this browser. Tokens minted here are CIP-68 tokens and already carry name, ticker, decimals and logo on-chain, they do not need the registry.
      </Notice>

      <PolicySelector keyHash={wallet.keyHash} selection={selection} />

      {policy && !policy.skey ? <Notice tone="warning">This policy is signed by your wallet key. Select or import a policy with its own signing key.</Notice> : null}

      <div className="surface grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Asset name (hex)" error={errors.assetName} hint={assetName ? `Text: ${assetNameFromHex(assetName)}` : undefined} className="sm:col-span-2">
          <input className={`${inputClass} font-mono text-xs`} value={assetName} onChange={(e) => setAssetName(e.target.value.trim().toLowerCase())} list="policy-assets" placeholder="4d79546f6b656e" />
          <datalist id="policy-assets">
            {policyAssets.map((asset) => (
              <option key={asset.name} value={asset.name}>
                {assetNameFromHex(asset.name)}
              </option>
            ))}
          </datalist>
        </Field>
        <Field label="Name" error={errors.name}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="My Token" />
        </Field>
        <Field label="Ticker (optional)" error={errors.ticker}>
          <input className={inputClass} value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="TKN" />
        </Field>
        <Field label="Description" error={errors.description} className="sm:col-span-2">
          <textarea className={textareaClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="URL (optional)" error={errors.url}>
          <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        </Field>
        <Field label="Decimals (optional)" error={errors.decimals}>
          <input className={inputClass} type="number" min="0" max={REGISTRY_LIMITS.decimals} value={decimals} onChange={(e) => setDecimals(e.target.value)} placeholder="0" />
        </Field>
        <Field label="Logo (optional, PNG, scaled down to 64 KB if needed)">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
            {logoUrl ? <img src={logoUrl} alt="Logo preview" className="size-10 rounded-field object-contain" /> : null}
            <label className={secondaryButtonClass}>
              {logo ? "Replace" : "Choose file"}
              <input type="file" accept="image/*" className="hidden" onChange={onLogo} />
            </label>
            {logo ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLogo(null)}>
                Remove
              </button>
            ) : null}
          </div>
        </Field>
        <Field label="Sequence number" error={errors.sequenceNumber} hint="0 for a new entry, one higher than the existing entry for an update">
          <input className={inputClass} type="number" min="0" value={sequenceNumber} onChange={(e) => setSequenceNumber(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <button className="btn btn-primary" disabled={!policy?.skey || !valid} onClick={generate}>
            Sign registry entry
          </button>
        </div>
      </div>

      {entry ? (
        <div className="surface flex flex-col gap-4 p-5">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Entry signed</h2>
            <p className="mt-1 text-sm text-base-content/55">
              Submit it as a pull request to the registry: add the file <span className="break-all font-mono text-xs">mappings/{filename}</span> to{" "}
              <span className="font-mono text-xs">{REGISTRY_REPOSITORY}</span>. GitHub forks the repository for you and opens the pull request from the page below.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={secondaryButtonClass} onClick={() => downloadJson(filename, entryJson)}>
              <ArrowDownTrayIcon className="size-4" />
              Download {shortenId(filename, 10)}
            </button>
            <button className={secondaryButtonClass} onClick={() => navigator.clipboard.writeText(entryJson)}>
              <ClipboardIcon className="size-4" />
              Copy JSON
            </button>
            <ExternalLink href={`https://github.com/${REGISTRY_REPOSITORY}/new/master/mappings?filename=${filename}`}>Create file on GitHub</ExternalLink>
          </div>
          <pre className="max-h-80 overflow-auto rounded-field bg-base-300 p-3 font-mono text-[11px] text-base-content/65">{entryJson}</pre>
        </div>
      ) : null}
    </div>
  );
}

export default function RegisterForm() {
  return <ConnectWallet message="Connect a wallet to register tokens of your policies.">{(wallet) => <Register wallet={wallet} />}</ConnectWallet>;
}
