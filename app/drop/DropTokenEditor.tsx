"use client";

import { answered } from "@cardano/answer";
import { DROP_NAME_MAX_BYTES, DropToken, listErrors, MAX_DROP_TOKENS, parseDropList } from "@cardano/dropScript";
import { assetNameFor, MetaValue } from "@cardano/metadata";
import { toIpfsUrl } from "@cardano/utils";
import IpfsImage from "@components/IpfsImage";
import { Field, inputClass, secondaryButtonClass } from "@components/ui";
import { ArrowDownTrayIcon, ArrowUpTrayIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { uploadToIpfs } from "@/app/mint/uploadToIpfs";
import { ChangeEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useState } from "react";

const MAX_FILE_BYTES = 104_857_600;

/** One attribute as the creator types it. Empty keys are ignored. */
interface Attribute {
  key: string;
  value: string;
}

/** What differs from token to token: named once, with the values a token can have, as typed with commas between them. */
interface Trait {
  name: string;
  values: string;
}

/** The values of a trait to choose from, each once. Without any, the value is typed at each token. */
const traitValues = (trait: Trait) => [...new Set(trait.values.split(",").map((value) => value.trim()).filter(Boolean))];

/** A token while the drop is being put together. */
interface DraftToken {
  id: string;
  assetName: string;
  name: string;
  image: string;
  mediaType: string;
  /** Local preview of an uploaded file, so it shows before the IPFS gateway has it. */
  preview?: string;
  attributes: Attribute[];
  /** Further metadata of an imported JSON file that is not edited here, kept as it is. */
  kept: Record<string, MetaValue>;
}

const RESERVED = new Set(["name", "image", "mediaType"]);
const PAGE_SIZE = 24;
const PARALLEL_UPLOADS = 4;
/** Small pictures shown right at the upload, so the tokens are seen without scrolling to the list. */
const THUMBNAILS = 40;

const EXAMPLE = `[
  { "assetName": "Robot001", "metadata": { "name": "Robot #1", "image": "ipfs://Qm…", "mediaType": "image/png", "eyes": "blue" } },
  { "assetName": "Robot002", "metadata": { "name": "Robot #2", "image": "ipfs://Qm…", "mediaType": "image/png", "eyes": "red" } }
]`;

const byteLength = (text: string) => new TextEncoder().encode(text).length;
const naturalOrder = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** An asset name from the display name that no other token uses yet. */
function uniqueAssetName(name: string, taken: Set<string>, fallback: number) {
  const base = assetNameFor(name) || `Token${String(fallback).padStart(4, "0")}`;
  let candidate = base;
  for (let n = 2; taken.has(candidate); n++) {
    const suffix = String(n);
    candidate = base.slice(0, DROP_NAME_MAX_BYTES - suffix.length) + suffix;
  }
  taken.add(candidate);
  return candidate;
}

function attributeErrors(attributes: Attribute[]) {
  const seen = new Set<string>();
  for (const { key } of attributes) {
    const trimmed = key.trim();
    if (!trimmed) continue;
    if (RESERVED.has(trimmed)) return `"${trimmed}" is set by the token itself`;
    if (seen.has(trimmed)) return `"${trimmed}" is used twice`;
    seen.add(trimmed);
  }
  return undefined;
}

/** More values than this are not offered as a list to pick from, the attribute stays as the file has it. */
const MAX_TRAIT_VALUES = 50;

/**
 * Finds the attributes of an imported list that can be edited here again, so that a list downloaded from this editor
 * comes back as it was: a text every token has with the same value is an attribute for all, a text that differs or
 * that only some tokens have is a trait with the values found. Anything else stays with the token as the file has it:
 * lists and numbers, and texts that do not fit a list of values separated by commas.
 */
function sortAttributes(tokens: Record<string, MetaValue>[]): { common: Attribute[]; traits: Trait[] } {
  const common: Attribute[] = [];
  const traits: Trait[] = [];
  for (const key of new Set(tokens.flatMap((token) => Object.keys(token)))) {
    const found = tokens.filter((token) => key in token).map((token) => token[key]);
    if (key !== key.trim() || !found.every((value): value is string => typeof value === "string" && value.trim() !== "")) continue;
    const values = [...new Set(found)];
    if (values.length === 1 && found.length === tokens.length) {
      common.push({ key, value: values[0] });
    } else if (values.length <= MAX_TRAIT_VALUES && values.every((value) => value === value.trim() && !value.includes(","))) {
      traits.push({ name: key, values: values.join(", ") });
    }
  }
  return { common, traits };
}

/** The tokens as they go into the drop: kept metadata, then the attributes for all, then the token's values for the traits. */
function buildTokens(drafts: DraftToken[], common: Attribute[]): DropToken[] {
  const apply = (target: Record<string, MetaValue>, attributes: Attribute[]) => {
    // a row without a value is left out, e.g. a trait that does not apply to this token
    for (const { key, value } of attributes) if (key.trim() && value.trim()) target[key.trim()] = value;
  };
  return drafts.map((draft) => {
    const metadata: Record<string, MetaValue> = { ...draft.kept };
    apply(metadata, common);
    apply(metadata, draft.attributes);
    metadata.name = draft.name;
    if (draft.image) metadata.image = draft.image;
    if (draft.mediaType) metadata.mediaType = draft.mediaType;
    return { assetName: draft.assetName, metadata };
  });
}

/** One numbered step of the editor: the number and the heading give the eye something to hold on to. */
function Step({ number, title, text, aside, children }: { number: number; title: string; text?: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{number}</span>
          <div>
            <h3 className="text-base font-semibold leading-7 tracking-tight text-base-content">{title}</h3>
            {text ? <p className="text-sm text-base-content/60">{text}</p> : null}
          </div>
        </div>
        {aside}
      </div>
      <div className="flex flex-col gap-3 sm:pl-10">{children}</div>
    </section>
  );
}

function AttributeRows({ attributes, onChange, keyPlaceholder = "website", valuePlaceholder = "https://…" }: {
  attributes: Attribute[];
  onChange: (attributes: Attribute[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const set = (index: number, patch: Partial<Attribute>) => onChange(attributes.map((attribute, i) => (i === index ? { ...attribute, ...patch } : attribute)));
  return (
    <div className="flex flex-col gap-2">
      {attributes.map((attribute, index) => (
        <div key={index} className="flex gap-2">
          <input className={`${inputClass} input-sm max-w-[14rem]`} placeholder={keyPlaceholder} value={attribute.key} onChange={(e) => set(index, { key: e.target.value })} aria-label="Attribute" />
          <input className={`${inputClass} input-sm`} placeholder={valuePlaceholder} value={attribute.value} onChange={(e) => set(index, { value: e.target.value })} aria-label="Value" />
          <button type="button" className="btn btn-ghost btn-sm btn-square text-base-content/55 hover:text-error" onClick={() => onChange(attributes.filter((_, i) => i !== index))} aria-label="Remove attribute">
            <TrashIcon className="size-4" />
          </button>
        </div>
      ))}
      <button type="button" className={`${secondaryButtonClass} self-start`} onClick={() => onChange([...attributes, { key: "", value: "" }])}>
        <PlusIcon className="size-4" /> Add attribute
      </button>
    </div>
  );
}

function TokenRow({ draft, traits, onChange, onRemove }: { draft: DraftToken; traits: Trait[]; onChange: (draft: DraftToken) => void; onRemove: () => void }) {
  const image = draft.preview ?? (draft.image ? toIpfsUrl(draft.image) : "");
  // a trait is an attribute whose name is given once for all tokens, only its value is typed here
  const traitValue = (trait: string) => draft.attributes.find((attribute) => attribute.key.trim() === trait)?.value ?? "";
  const setTrait = (trait: string, value: string) =>
    onChange({ ...draft, attributes: [...draft.attributes.filter((attribute) => attribute.key.trim() !== trait), ...(value ? [{ key: trait, value }] : [])] });
  const keptKeys = Object.keys(draft.kept);
  const nameError = !draft.name.trim() ? "Needs a name" : undefined;
  const bytes = byteLength(draft.assetName);
  const assetError = bytes === 0 || bytes > DROP_NAME_MAX_BYTES ? `1 to ${DROP_NAME_MAX_BYTES} bytes` : undefined;

  return (
    <div className="flex flex-col gap-3 rounded-field border border-line bg-base-200 p-3">
      <div className="flex items-start gap-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-field bg-base-300">
          {image ? <IpfsImage width="64" height="64" className="aspect-square w-full object-cover" src={image} alt={draft.name} unoptimized /> : null}
        </div>
        {/* the traits sit in the column of the name, so that they end where the fields above them end */}
        <div className="flex min-w-0 grow flex-col gap-2">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <Field label="Name" error={nameError}>
              <input className={`${inputClass} input-sm`} value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Asset name" error={assetError}>
              <input className={`${inputClass} input-sm font-mono text-[13px]`} value={draft.assetName} onChange={(e) => onChange({ ...draft, assetName: e.target.value })} />
            </Field>
          </div>
          {traits.length ? (
            <div className="grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
              {traits.map((trait) => {
                const value = traitValue(trait.name);
                const values = traitValues(trait);
                return (
                  <Field key={trait.name} label={trait.name}>
                    {values.length ? (
                      <select className="select select-sm w-full border-line bg-base-300" value={value} onChange={(e) => setTrait(trait.name, e.target.value)}>
                        <option value="">None</option>
                        {/* a value chosen before the list was changed stays, until another one is picked */}
                        {(value && !values.includes(value) ? [value, ...values] : values).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input className={`${inputClass} input-sm`} value={value} onChange={(e) => setTrait(trait.name, e.target.value)} />
                    )}
                  </Field>
                );
              })}
            </div>
          ) : null}
        </div>
        <button type="button" className="btn btn-ghost btn-sm btn-square mt-5 text-base-content/55 hover:text-error" onClick={onRemove} aria-label="Remove token">
          <TrashIcon className="size-4" />
        </button>
      </div>
      {keptKeys.length ? <p className="text-xs text-base-content/55">From the file: {keptKeys.join(", ")}</p> : null}
    </div>
  );
}

/**
 * Puts the tokens of a drop together: from images, which are uploaded to IPFS, or from a JSON list for those who
 * prepare their collection elsewhere. Attributes with one value go into all tokens at once, traits are named once and get a value per token.
 * Answers with the finished list, or null while it is empty or has errors.
 */
export default function DropTokenEditor({ onChange, firstStep = 1 }: { onChange: (tokens: DropToken[] | null) => void; firstStep?: number }) {
  const [mode, setMode] = useState<"images" | "json">("images");
  const [drafts, setDrafts] = useState<DraftToken[]>([]);
  const [common, setCommon] = useState<Attribute[]>([{ key: "website", value: "" }]);
  const [traits, setTraits] = useState<Trait[]>([]);
  const [newTrait, setNewTrait] = useState("");
  const [newValues, setNewValues] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string>();
  const [page, setPage] = useState(0);
  const [prefix, setPrefix] = useState("");

  const tokens = useMemo(() => buildTokens(drafts, common), [drafts, common]);
  const commonError = attributeErrors(common);
  const errors = drafts.length ? [...listErrors(tokens), ...(commonError ? [`Attributes for all: ${commonError}`] : [])] : [];

  useEffect(() => {
    onChange(drafts.length && errors.length === 0 ? tokens : null);
    // errors follow from tokens and the attributes, which are in the list through tokens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens, drafts.length, commonError]);

  const pages = Math.max(1, Math.ceil(drafts.length / PAGE_SIZE));
  const shownPage = Math.min(page, pages - 1);

  const addImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])].sort((a, b) => naturalOrder.compare(a.name, b.name));
    event.target.value = "";
    setFileError(undefined);
    if (files.length === 0) return;
    if (files.some((file) => file.size > MAX_FILE_BYTES)) return setFileError("At most 100 MB per file");
    if (drafts.length + files.length > MAX_DROP_TOKENS) return setFileError(`A drop holds at most ${MAX_DROP_TOKENS.toLocaleString("en")} tokens`);
    const taken = new Set(drafts.map((draft) => draft.assetName));
    const added: DraftToken[] = files.map((file, index) => {
      const name = file.name.replace(/\.[^.]*$/, "").slice(0, 60) || `Token ${drafts.length + index + 1}`;
      return {
        id: crypto.randomUUID(),
        assetName: uniqueAssetName(name, taken, drafts.length + index + 1),
        name,
        image: "",
        mediaType: file.type,
        preview: URL.createObjectURL(file),
        attributes: [],
        kept: {},
      };
    });
    let done = 0;
    const cids: string[] = new Array(files.length);
    setUploading(`Uploading 0 of ${files.length}`);
    try {
      let next = 0;
      const worker = async () => {
        while (next < files.length) {
          const index = next++;
          cids[index] = await answered(uploadToIpfs(files[index]));
          setUploading(`Uploading ${++done} of ${files.length}`);
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARALLEL_UPLOADS, files.length) }, worker));
      setDrafts((current) => [...current, ...added.map((draft, index) => ({ ...draft, image: `ipfs://${cids[index]}` }))]);
    } catch (error) {
      added.forEach((draft) => draft.preview && URL.revokeObjectURL(draft.preview));
      setFileError(error instanceof Error ? error.message : "The upload to IPFS failed. Please try again.");
    } finally {
      setUploading(null);
    }
  };

  const readJson = async (file: File | undefined) => {
    setFileError(undefined);
    if (!file) return;
    try {
      const parsed = parseDropList(JSON.parse(await file.text()));
      const rest = parsed.map((token) => {
        const { name, image, mediaType, ...other } = (token.metadata ?? {}) as Record<string, MetaValue>;
        return { token, name, image, mediaType, other };
      });
      const { common: fileCommon, traits: fileTraits } = sortAttributes(rest.map((entry) => entry.other));
      const edited = new Set([...fileCommon.map((attribute) => attribute.key), ...fileTraits.map((trait) => trait.name)]);
      const traitNames = new Set(fileTraits.map((trait) => trait.name));
      setDrafts(
        rest.map(({ token, name, image, mediaType, other }) => ({
          id: crypto.randomUUID(),
          assetName: token.assetName,
          name: typeof name === "string" ? name : "",
          image: typeof image === "string" ? image : Array.isArray(image) ? image.join("") : "",
          mediaType: typeof mediaType === "string" ? mediaType : "",
          attributes: Object.entries(other).flatMap(([key, value]) => (traitNames.has(key) ? [{ key, value: value as string }] : [])),
          kept: Object.fromEntries(Object.entries(other).filter(([key]) => !edited.has(key))),
        }))
      );
      // the file replaces the list, so its attributes and traits replace those typed before
      setCommon(fileCommon.length ? fileCommon : [{ key: "website", value: "" }]);
      setTraits(fileTraits);
      setPage(0);
    } catch {
      setFileError("This file is not a JSON list of tokens");
    }
  };

  const traitName = newTrait.trim();
  const traitError = RESERVED.has(traitName) ? `"${traitName}" is set by the token itself` : traits.some((trait) => trait.name === traitName) ? `"${traitName}" is there already` : common.some((attribute) => attribute.key.trim() === traitName && attribute.value.trim()) ? `"${traitName}" is set for all tokens above` : undefined;
  const addTrait = () => {
    if (!traitName || traitError) return;
    setTraits([...traits, { name: traitName, values: newValues }]);
    setNewTrait("");
    setNewValues("");
  };
  const addOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    addTrait();
  };
  /** Takes the trait out of every token, with the values chosen for it. */
  const removeTrait = (trait: string) => {
    setTraits(traits.filter((other) => other.name !== trait));
    setDrafts((current) => current.map((draft) => ({ ...draft, attributes: draft.attributes.filter((attribute) => attribute.key.trim() !== trait) })));
  };

  const numberAll = () => {
    const width = Math.max(3, String(drafts.length).length);
    const base = assetNameFor(prefix) || "Token";
    setDrafts(
      drafts.map((draft, index) => {
        const number = String(index + 1).padStart(width, "0");
        return { ...draft, name: `${prefix}${index + 1}`, assetName: base.slice(0, DROP_NAME_MAX_BYTES - number.length) + number };
      })
    );
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(tokens, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "drop.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const clear = () => {
    if (!confirm(`Remove all ${drafts.length} tokens from the list?`)) return;
    drafts.forEach((draft) => draft.preview && URL.revokeObjectURL(draft.preview));
    setDrafts([]);
    setPage(0);
  };

  return (
    <div className="flex flex-col gap-4">
      <Step
        number={firstStep}
        title="Your tokens"
        text={mode === "images" ? "Every image becomes one token, named after its file. The images are stored on IPFS." : "A list you prepared elsewhere."}
        aside={
          <div className="join">
            {(["images", "json"] as const).map((option) => (
              <button key={option} type="button" className={`btn btn-sm join-item border-line ${mode === option ? "btn-primary" : "bg-base-300"}`} onClick={() => setMode(option)}>
                {option === "images" ? "Upload images" : "JSON file (advanced)"}
              </button>
            ))}
          </div>
        }
      >
      {mode === "images" ? (
        <div className="flex flex-wrap items-center gap-2">
        <Field label="" error={fileError}>
          <label className={`${secondaryButtonClass} self-start ${uploading ? "btn-disabled" : ""}`}>
            {uploading ? <span className="loading loading-spinner loading-xs" /> : <ArrowUpTrayIcon className="size-4" />}
            {uploading ?? (drafts.length ? "Add more images" : "Choose images")}
            <input type="file" multiple accept="image/*,video/*,model/*,.glb,.gltf" className="hidden" disabled={!!uploading} onChange={addImages} />
          </label>
        </Field>
          {drafts.slice(0, THUMBNAILS).map((draft) => {
            const image = draft.preview ?? (draft.image ? toIpfsUrl(draft.image) : "");
            return (
              <div key={draft.id} className="size-10 shrink-0 overflow-hidden rounded-field bg-base-300" title={draft.name}>
                {image ? <IpfsImage width="40" height="40" className="aspect-square w-full object-cover" src={image} alt={draft.name} unoptimized /> : null}
              </div>
            );
          })}
          {drafts.length > THUMBNAILS ? <span className="text-sm text-base-content/55">+{(drafts.length - THUMBNAILS).toLocaleString("en")} more</span> : null}
        </div>
      ) : (
        <Field label="" error={fileError} hint={`Up to ${MAX_DROP_TOKENS.toLocaleString("en")} tokens. The images have to be on IPFS already. Loading a file replaces the list below.`}>
          <input type="file" accept="application/json,.json" className="file-input w-full border-line bg-base-300" onChange={(event) => readJson(event.target.files?.[0])} />
          <details className="mt-2 text-sm text-base-content/65">
            <summary className="cursor-pointer">What the file looks like</summary>
            <p className="mt-2">
              One entry per token: the asset name (up to {DROP_NAME_MAX_BYTES} bytes, each only once) and its metadata as on the mint page. The metadata needs at least
              a name. A file with one entry per asset name, as the JSON editor of the mint page writes it, works too. You can still set attributes for all tokens
              below after loading it.
            </p>
            <pre className="mt-2 overflow-x-auto rounded-field bg-base-300 p-3 text-xs">{EXAMPLE}</pre>
          </details>
        </Field>
      )}
      </Step>

      {drafts.length ? (
        <>
          <Step number={firstStep + 1} title="Same for all tokens" text="Attributes every token gets, for example website or artist. Rows without a value are left out.">
            <AttributeRows attributes={common} onChange={setCommon} />
            {commonError ? <span className="text-[11px] text-error">{commonError}</span> : null}
          </Step>

          <Step
            number={firstStep + 2}
            title="Traits"
            text="What differs from token to token, for example color or eyes. Name it and list its values once, then pick one at each token below."
          >
            {traits.map((trait) => (
              <div key={trait.name} className="flex items-center gap-2">
                <span className="w-[14rem] shrink-0 truncate rounded-field border border-primary/40 bg-primary/10 px-3 py-1 text-sm font-medium text-primary" title={trait.name}>
                  {trait.name}
                </span>
                <input
                  className={`${inputClass} input-sm`}
                  placeholder="blue, red, green"
                  value={trait.values}
                  onChange={(e) => setTraits(traits.map((other) => (other.name === trait.name ? { ...other, values: e.target.value } : other)))}
                  aria-label={`Values of ${trait.name}`}
                />
                <button type="button" className="btn btn-ghost btn-sm btn-square text-base-content/55 hover:text-error" onClick={() => removeTrait(trait.name)} aria-label={`Remove trait ${trait.name}`}>
                  <TrashIcon className="size-4" />
                </button>
              </div>
            ))}
            <div className="flex items-start gap-2">
              <Field label="" error={traitError} className="w-[14rem] shrink-0">
                <input className={`${inputClass} input-sm`} placeholder="color" value={newTrait} onChange={(e) => setNewTrait(e.target.value)} onKeyDown={addOnEnter} aria-label="New trait" />
              </Field>
              <input className={`${inputClass} input-sm`} placeholder="blue, red, green" value={newValues} onChange={(e) => setNewValues(e.target.value)} onKeyDown={addOnEnter} aria-label="Values of the new trait" />
              <button type="button" className={secondaryButtonClass} disabled={!traitName || !!traitError} onClick={addTrait}>
                <PlusIcon className="size-4" /> Add trait
              </button>
            </div>
          </Step>

          <Step
            number={firstStep + 3}
            title={`Check your ${drafts.length.toLocaleString("en")} token${drafts.length === 1 ? "" : "s"}`}
            text="Names and trait values, in the order the tokens are numbered."
            aside={
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondaryButtonClass} onClick={download}>
                  <ArrowDownTrayIcon className="size-4" /> Download as JSON
                </button>
                <button type="button" className={`${secondaryButtonClass} hover:text-error`} onClick={clear}>
                  <TrashIcon className="size-4" /> Remove all
                </button>
              </div>
            }
          >
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Number all tokens" hint={`Names become "${prefix || "Robot #"}1", "${prefix || "Robot #"}2", …`} className="grow sm:max-w-xs">
                <input className={`${inputClass} input-sm`} placeholder="Robot #" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
              </Field>
              <button type="button" className={`${secondaryButtonClass} mb-5`} disabled={!prefix.trim()} onClick={numberAll}>
                Rename
              </button>
            </div>

            {drafts.slice(shownPage * PAGE_SIZE, (shownPage + 1) * PAGE_SIZE).map((draft) => (
              <TokenRow
                key={draft.id}
                draft={draft}
                traits={traits}
                onChange={(changed) => setDrafts((current) => current.map((item) => (item.id === changed.id ? changed : item)))}
                onRemove={() => {
                  if (draft.preview) URL.revokeObjectURL(draft.preview);
                  setDrafts((current) => current.filter((item) => item.id !== draft.id));
                }}
              />
            ))}

            {pages > 1 ? (
              <div className="flex items-center justify-center gap-3 text-sm">
                <button type="button" className={secondaryButtonClass} disabled={shownPage === 0} onClick={() => setPage(shownPage - 1)}>
                  Back
                </button>
                <span className="text-base-content/65">
                  Page {shownPage + 1} of {pages}
                </span>
                <button type="button" className={secondaryButtonClass} disabled={shownPage >= pages - 1} onClick={() => setPage(shownPage + 1)}>
                  Next
                </button>
              </div>
            ) : null}

            {errors.length ? <p className="text-sm text-error">{errors.join(" · ")}</p> : null}
          </Step>
        </>
      ) : null}
    </div>
  );
}
