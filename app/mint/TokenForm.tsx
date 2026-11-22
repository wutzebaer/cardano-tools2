import { assetNameFor } from "@cardano/metadata";
import { MintToken, TokenFile, TokenProperty } from "@cardano/types";
import { toIpfsUrl } from "@cardano/utils";
import IpfsImage from "@components/IpfsImage";
import { Field, inputClass, textareaClass } from "@components/ui";
import { DocumentDuplicateIcon, PlusIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ChangeEvent, useState } from "react";
import { uploadToIpfs } from "./uploadToIpfs";

/** Same limits as the old mint form: ≤ 16 KB can go on-chain, otherwise IPFS, max 100 MB. */
export const MAX_FILE_BYTES = 104_857_600;
const ONCHAIN_FILE_BYTES = 16_384;

export function tokenErrors(token: MintToken, allTokens: MintToken[]) {
  const errors: Partial<Record<"amount" | "name" | "image" | "decimals", string>> = {};
  if (!token.name.trim()) {
    errors.name = "Required";
  } else if (!token.assetName) {
    errors.name = "Needs letters or numbers";
  } else if (allTokens.some((other) => other.id !== token.id && other.assetName === token.assetName)) {
    errors.name = "Duplicate asset name";
  }
  if (!/^\d+$/.test(token.amount) || Number(token.amount) < 1) {
    errors.amount = "Whole number ≥ 1";
  }
  if (token.standard === 222 && !token.image.trim()) {
    errors.image = "Required";
  }
  if (token.standard === 333 && token.decimals && !/^\d+$/.test(token.decimals)) {
    errors.decimals = "Whole number";
  }
  return errors;
}

/** Small files can be stored on-chain as a data URI, everything else goes to IPFS. */
async function storeFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Max 100mb");
  }
  if (file.size < ONCHAIN_FILE_BYTES && confirm(`Store file ${file.name} onchain?`)) {
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }
  return `ipfs://${await uploadToIpfs(file)}`;
}

const displayUri = (uri: string) => (uri.startsWith("data:") ? "(on-chain file)" : uri);

export default function TokenForm({
  token,
  allTokens,
  onChange,
  onCopyToAll,
  onRemove,
}: {
  token: MintToken;
  allTokens: MintToken[];
  onChange: (token: MintToken) => void;
  /** Applies the given fields of this token to all other tokens */
  onCopyToAll?: (patch: Partial<MintToken>) => void;
  onRemove?: () => void;
}) {
  const errors = tokenErrors(token, allTokens);
  const isNft = token.standard === 222;
  const [uploading, setUploading] = useState<"image" | "file" | null>(null);
  const update = (patch: Partial<MintToken>) => onChange({ ...token, ...patch });
  const updateProperty = (index: number, patch: Partial<TokenProperty>) =>
    update({ properties: token.properties.map((property, i) => (i === index ? { ...property, ...patch } : property)) });
  const updateFile = (index: number, patch: Partial<TokenFile>) => update({ files: token.files.map((file, i) => (i === index ? { ...file, ...patch } : file)) });

  const onImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading("image");
    try {
      update({ image: await storeFile(file), mediaType: file.type });
    } finally {
      setUploading(null);
    }
  };

  const onFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const selected = [...(e.target.files ?? [])];
    e.target.value = "";
    setUploading("file");
    try {
      const added: TokenFile[] = [];
      for (const file of selected) {
        added.push({ name: file.name.slice(0, 64), mediaType: file.type, src: await storeFile(file) });
      }
      update({ files: [...token.files, ...added] });
    } finally {
      setUploading(null);
    }
  };

  const extraKeys = Object.keys(token.extra);

  return (
    <div className="surface flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="join">
          {([222, 333] as const).map((standard) => (
            <button
              key={standard}
              type="button"
              className={`btn btn-sm join-item border-line ${token.standard === standard ? "btn-primary" : "bg-base-300"}`}
              onClick={() => update({ standard, amount: standard === 222 ? "1" : token.amount })}
            >
              {standard === 222 ? "NFT" : "Fungible"}
            </button>
          ))}
        </div>
        {onRemove ? (
          <button type="button" className="btn btn-ghost btn-sm btn-square text-base-content/55 hover:text-error" onClick={onRemove} aria-label="Remove token">
            <TrashIcon className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <div className="surface relative aspect-square overflow-hidden bg-base-300">
            {uploading === "image" ? (
              <div className="flex h-full items-center justify-center">
                <span className="loading loading-spinner loading-md" />
              </div>
            ) : token.image ? (
              <IpfsImage src={toIpfsUrl(token.image)} alt="" width="256" height="256" className="aspect-square w-full object-cover" unoptimized />
            ) : (
              <label className="flex h-full cursor-pointer items-center justify-center p-3 text-center text-xs text-base-content/45 hover:text-base-content">
                Upload file (IPFS, max 100 MB)
                <input type="file" className="hidden" onChange={onImage} />
              </label>
            )}
            {token.image ? (
              <button
                type="button"
                className="btn btn-xs btn-circle absolute right-2 top-2 border-line bg-base-100/80"
                onClick={() => update({ image: "", mediaType: "" })}
                aria-label="Remove image"
              >
                <XMarkIcon className="size-3" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={errors.name}>
            <input
              className={inputClass}
              value={token.name}
              onChange={(e) => update({ name: e.target.value, assetName: assetNameFor(e.target.value) })}
              placeholder="My token"
            />
            {token.assetName && token.assetName !== token.name.trim() ? (
              <span className="text-[11px] text-base-content/45">Asset name {token.assetName}</span>
            ) : null}
          </Field>
          <Field label={isNft ? "Amount" : "Amount (smallest unit)"} error={errors.amount}>
            <input className={inputClass} type="number" min="1" value={token.amount} disabled={isNft} onChange={(e) => update({ amount: e.target.value })} />
          </Field>
          <Field label={isNft ? "Image URI" : "Logo URI"} error={errors.image}>
            <input
              className={inputClass}
              value={displayUri(token.image)}
              readOnly={token.image.startsWith("data:")}
              onChange={(e) => update({ image: e.target.value })}
              placeholder="ipfs://… or https://…"
            />
          </Field>
          {isNft ? (
            <Field label="Media type">
              <input className={inputClass} value={token.mediaType} onChange={(e) => update({ mediaType: e.target.value })} placeholder="image/png" />
            </Field>
          ) : (
            <>
              <Field label="Ticker">
                <input className={inputClass} value={token.ticker} onChange={(e) => update({ ticker: e.target.value })} placeholder="TKN" />
              </Field>
              <Field label="Decimals" error={errors.decimals}>
                <input className={inputClass} type="number" min="0" value={token.decimals} onChange={(e) => update({ decimals: e.target.value })} placeholder="0" />
              </Field>
              <Field label="URL">
                <input className={inputClass} value={token.url} onChange={(e) => update({ url: e.target.value })} placeholder="https://…" />
              </Field>
            </>
          )}
          <Field label="Description" className="sm:col-span-2">
            <textarea className={textareaClass} rows={2} value={token.description} onChange={(e) => update({ description: e.target.value })} />
          </Field>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-base-content/55">Additional files</span>
          <label className={`btn btn-ghost btn-xs gap-1 ${uploading === "file" ? "btn-disabled" : ""}`}>
            {uploading === "file" ? <span className="loading loading-spinner loading-xs" /> : <PlusIcon className="size-3.5" />}
            Add
            <input type="file" multiple className="hidden" onChange={onFiles} disabled={uploading === "file"} />
          </label>
        </div>
        {token.files.map((file, index) => (
          <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1.4fr)_auto]">
            <input className="input input-sm w-full border-line bg-base-300" value={file.name} onChange={(e) => updateFile(index, { name: e.target.value })} placeholder="name" />
            <input className="input input-sm w-full border-line bg-base-300" value={file.mediaType} onChange={(e) => updateFile(index, { mediaType: e.target.value })} placeholder="media type" />
            <input
              className="input input-sm w-full border-line bg-base-300"
              value={displayUri(file.src)}
              readOnly={file.src.startsWith("data:")}
              onChange={(e) => updateFile(index, { src: e.target.value })}
              placeholder="ipfs://… or https://…"
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square text-base-content/45 hover:text-error"
              onClick={() => update({ files: token.files.filter((_, i) => i !== index) })}
              aria-label="Remove file"
            >
              <XMarkIcon className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-base-content/55">Custom properties</span>
          {onCopyToAll ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs ml-auto gap-1"
              title="Copy description and custom properties to all other tokens"
              onClick={() => onCopyToAll({ description: token.description, properties: token.properties.map((property) => ({ ...property })) })}
            >
              <DocumentDuplicateIcon className="size-3.5" />
              Copy to all
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-xs gap-1"
            onClick={() => update({ properties: [...token.properties, { key: "", value: "" }] })}
          >
            <PlusIcon className="size-3.5" />
            Add
          </button>
        </div>
        {token.properties.map((property, index) => (
          <div key={index} className="flex gap-2">
            <input className="input input-sm w-2/5 border-line bg-base-300" value={property.key} onChange={(e) => updateProperty(index, { key: e.target.value })} placeholder="key" />
            <input className="input input-sm grow border-line bg-base-300" value={property.value} onChange={(e) => updateProperty(index, { value: e.target.value })} placeholder="value" />
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square text-base-content/45 hover:text-error"
              onClick={() => update({ properties: token.properties.filter((_, i) => i !== index) })}
              aria-label="Remove property"
            >
              <XMarkIcon className="size-4" />
            </button>
          </div>
        ))}
        {extraKeys.length > 0 ? (
          <p className="text-[11px] text-base-content/45">
            Also set through the metadata editor: <span className="font-mono">{extraKeys.join(", ")}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
