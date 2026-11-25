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
