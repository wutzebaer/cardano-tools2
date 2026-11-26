import { groupOfMarker } from "@cardano/dropScript";
import { cip67Label } from "@cardano/utils";

/**
 * Tokens that are there for a policy to work and are nothing to collect: they have no picture of their own, so the
 * lists show what they are instead of an empty tile.
 */
export interface TechnicalToken {
  kind: "royalty" | "group" | "reference";
  /** What to call the token where its metadata gives no name */
  name?: string;
  /** One word on its picture */
  badge: string;
  /** One line below its name */
  note: string;
}

/**
 * Whether a token stays out of the lists of tokens: the reference NFT of CIP-68 would show its token a second time,
 * and the marker of a drop group never leaves the contract. Nobody can own either. The royalty token is listed, it
 * lies in a wallet and its owner wants to find it.
 */
export function isListed(nameHex: string | null | undefined) {
  const kind = technicalToken(nameHex)?.kind;
  return kind !== "reference" && kind !== "group";
}

/** Text a person can read: no bytes that are no text, no control characters. */
function isReadable(text: string) {
  return text.trim() !== "" && !/[\uFFFD\u0000-\u001F\u007F-\u009F]/.test(text);
}

/** The asset name (hex) as text, undefined where its bytes are no text. A CIP-67 label in front is left out. */
function assetNameText(nameHex: string) {
  try {
    const bytes = Buffer.from(cip67Label(nameHex) != null ? nameHex.slice(8) : nameHex, "hex");
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

/**
 * Whether a token has anything to show in a feed of tokens: a picture, or a name that reads as text. Contracts keep
 * their books in tokens named by a hash, without metadata; a list full of those says nothing to anybody.
 */
export function isPresentable(token: { maName: string; name?: string | null; image?: string | null }) {
  if (token.image) return true;
  // the royalty token has no name of its own and is shown as what it is
  if (!token.maName) return true;
  const assetName = assetNameText(token.maName);
  return assetName !== undefined && isReadable(assetName) && (!token.name || isReadable(token.name));
}

/** What a token is by its asset name (hex), undefined for an ordinary one. */
export function technicalToken(nameHex: string | null | undefined): TechnicalToken | undefined {
  // CIP-27: the token without a name is the one whose mint set the royalties of its policy
  if (!nameHex) return { kind: "royalty", name: "Royalty token", badge: "Royalties", note: "Sets the royalties of this policy" };
  const group = groupOfMarker(nameHex);
  // a drop keeps what it sells in groups, each known by its marker; closing the drop burns them
  if (group !== undefined && !Number.isNaN(group)) return { kind: "group", name: `Drop group ${group + 1}`, badge: "Drop", note: "Keeps a part of a drop while it is for sale" };
  // CIP-68: the reference NFT holds the metadata of the token people own
  if (cip67Label(nameHex) === 100) return { kind: "reference", badge: "Metadata", note: "Carries the metadata of its token" };
  return undefined;
}
