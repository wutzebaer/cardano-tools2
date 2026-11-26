/** Metadata of CIP-68 tokens as plain JSON, no wallet or serialization library involved. */
import type { MintToken, TokenFile } from "./types";

export type MetaValue = string | number | MetaValue[] | { [key: string]: MetaValue };

/** Asset names are limited to 32 bytes, the CIP-67 label of CIP-68 tokens takes 4 of them. */
export const ASSET_NAME_MAX_BYTES = 28;

const utf8Length = (text: string) => new TextEncoder().encode(text).length;

/** On-chain asset name from the display name: alphanumeric only, cut to the allowed length. */
export function assetNameFor(name: string) {
  return name.replace(/[^a-zA-Z0-9]/g, "").slice(0, ASSET_NAME_MAX_BYTES);
}

/** Metadata of one token as it goes into the datum of its reference NFT; unset optional fields are left out. */
export function tokenMetadata(token: MintToken): Record<string, MetaValue> {
  const metadata: Record<string, MetaValue> = { name: token.name };
  if (token.standard === 222) {
    metadata.image = token.image;
    if (token.mediaType) metadata.mediaType = token.mediaType;
  }
  if (token.description) metadata.description = token.description;
  if (token.standard === 333) {
    if (token.ticker) metadata.ticker = token.ticker;
    if (token.url) metadata.url = token.url;
    if (token.decimals) metadata.decimals = Number(token.decimals);
    if (token.image) metadata.logo = token.image;
  }
  const files = token.files.filter((file) => file.src);
  if (files.length > 0) {
    metadata.files = files.map((file) => ({ ...(file.name ? { name: file.name } : {}), ...(file.mediaType ? { mediaType: file.mediaType } : {}), src: file.src }));
  }
  // a property that was left empty, e.g. one added for all tokens that does not apply to this one, is not written
  for (const { key, value } of token.properties) {
    if (key && value) metadata[key] = value;
  }
  return { ...metadata, ...token.extra };
}

/** A text in the metadata of a transaction holds 64 bytes at most. */
const METADATA_TEXT_BYTES = 64;

/** Cuts a text into pieces of at most 64 bytes, never inside a character. */
function textPieces(text: string) {
  const pieces: string[] = [];
  let piece = "";
  let size = 0;
  for (const character of text) {
    const bytes = utf8Length(character);
    if (size + bytes > METADATA_TEXT_BYTES) {
      pieces.push(piece);
      piece = "";
      size = 0;
    }
    piece += character;
    size += bytes;
  }
  pieces.push(piece);
  return pieces;
}

/** Metadata as it fits into a transaction: a longer text becomes a list of its pieces, which readers of CIP-25 join again. */
function inPieces(value: MetaValue): MetaValue {
  if (typeof value === "string") return utf8Length(value) > METADATA_TEXT_BYTES ? textPieces(value) : value;
  if (typeof value === "number") return value;
  if (Array.isArray(value)) return value.map(inPieces);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, inPieces(item)]));
}

/**
 * The CIP-25 metadata of a mint, which goes under label 721 of its transaction: the tokens of the policy by their
 * asset name. Version 1, where policy id and asset name are written as text.
 */
export function cip25Metadata(policyId: string, tokens: MintToken[]): Record<string, MetaValue> {
  return { [policyId]: Object.fromEntries(tokens.map((token) => [token.assetName, inPieces(cip25Fields(tokenMetadata(token)))])) };
}

/** CIP-25 knows the picture of a token as "image". The logo of a fungible token, which CIP-68 calls "logo", goes there. */
function cip25Fields(metadata: Record<string, MetaValue>): Record<string, MetaValue> {
  const { logo, ...rest } = metadata;
  return logo === undefined || rest.image !== undefined ? metadata : { ...rest, image: logo };
}

/** Metadata of all tokens keyed by asset name, the shape the JSON editor works on. */
export function tokensMetadata(tokens: MintToken[]) {
  return Object.fromEntries(tokens.map((token) => [token.assetName, tokenMetadata(token)]));
}

/** Metadata written by other tools may split long text into an array of strings. */
function joinedText(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((part) => typeof part === "string")) return value.join("");
  return undefined;
}

const FORM_FIELDS = ["name", "image", "mediaType", "description", "ticker", "url", "decimals", "logo", "files"];

/**
 * Rebuilds the token list from edited metadata keyed by asset name. Tokens that already exist keep their amount.
 * Fields the form has no input for (nested objects, numbers, lists) are kept as they are in `extra`.
 */
export function tokensFromMetadata(json: unknown, existing: MintToken[]): MintToken[] {
  if (json == null || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("Metadata needs to be an object with one entry per asset name");
  }
  const assets = Object.entries(json as Record<string, unknown>);
  if (assets.length === 0) {
    throw new Error("Metadata contains no tokens");
  }

  return assets.map(([assetName, value]) => {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`Metadata of ${assetName} is not an object`);
    }
    if (!assetName || utf8Length(assetName) > ASSET_NAME_MAX_BYTES) {
      throw new Error(`Asset name ${assetName} must be 1 to ${ASSET_NAME_MAX_BYTES} bytes`);
    }
    const metadata = value as Record<string, MetaValue>;
    const previous = existing.find((token) => token.assetName === assetName);
    const isFungible = metadata.ticker != null || metadata.decimals != null || (metadata.logo != null && metadata.image == null);

    const files: TokenFile[] = (Array.isArray(metadata.files) ? metadata.files : []).flatMap((file) => {
      const entry = file as Record<string, unknown>;
      const src = joinedText(entry?.src);
      return src ? [{ name: joinedText(entry.name) ?? "", mediaType: joinedText(entry.mediaType) ?? "", src }] : [];
    });

    const properties: MintToken["properties"] = [];
    const extra: Record<string, MetaValue> = {};
    for (const [key, item] of Object.entries(metadata)) {
      if (FORM_FIELDS.includes(key)) continue;
      if (typeof item === "string") {
        properties.push({ key, value: item });
      } else {
        extra[key] = item;
      }
    }

    return {
      id: previous?.id ?? crypto.randomUUID(),
      standard: isFungible ? 333 : 222,
      assetName,
      amount: previous?.amount ?? "1",
      name: joinedText(metadata.name) ?? assetName,
      description: joinedText(metadata.description) ?? "",
      image: joinedText(metadata.image) ?? joinedText(metadata.logo) ?? "",
      mediaType: joinedText(metadata.mediaType) ?? "",
      ticker: joinedText(metadata.ticker) ?? "",
      url: joinedText(metadata.url) ?? "",
      decimals: metadata.decimals == null ? "" : String(metadata.decimals),
      files,
      properties,
      extra,
    };
  });
}
