/**
 * CIP-88: what the owner of a policy registers about it on chain, here the name of its collection.
 *
 * The standard knows two proofs that a registration comes from the owner. A signature of the policy key over the
 * registration is one, but a wallet only signs transactions and CIP-8 messages, not bare bytes. So the other one is
 * used: the registration travels in a transaction that mints the token with the empty name under the policy, the
 * "beacon", which nobody but the owner can do. That is the royalty token of CIP-27, so both are set in one transaction.
 */
export const REGISTRATION_LABEL = 867;

/** Transaction metadata holds at most 64 bytes per string or byte string. */
const METADATA_BYTES = 64;

/** Transaction metadata as the serialization library reads it with its detailed schema, which knows integer keys and bytes. */
export type Metadatum = { int: number } | { string: string } | { bytes: string } | { list: Metadatum[] } | { map: { k: Metadatum; v: Metadatum }[] };

const int = (value: number): Metadatum => ({ int: value });
const text = (value: string): Metadatum => ({ string: value });
const bytes = (hex: string): Metadatum => ({ bytes: hex });
const list = (...items: Metadatum[]): Metadatum => ({ list: items });
const map = (...entries: [number, Metadatum][]): Metadatum => ({ map: entries.map(([key, value]) => ({ k: int(key), v: value })) });

/** Longer texts are written in pieces. Cut by bytes and between characters, so every piece is valid on its own. */
function pieces(value: string): string[] {
  const encoder = new TextEncoder();
  const result: string[] = [];
  let piece = "";
  let length = 0;
  for (const character of value) {
    const bytes = encoder.encode(character).length;
    if (length + bytes > METADATA_BYTES) {
      result.push(piece);
      piece = "";
      length = 0;
    }
    piece += character;
    length += bytes;
  }
  return piece ? [...result, piece] : result;
}

export const DESCRIPTION_MAX_LENGTH = 500;

/** Why a collection name cannot be registered, undefined if it can. */
export function collectionNameError(name: string): string | undefined {
  const length = new TextEncoder().encode(name.trim()).length;
  if (length === 0) return "Needs a name";
  return length > METADATA_BYTES ? `At most ${METADATA_BYTES} bytes` : undefined;
}

export interface Registration {
  policyId: string;
  /** The native script of the policy as CBOR, hex. With it a reader can check the policy id without looking anything up. */
  scriptCbor: string;
  name: string;
  description?: string;
  /** Address of a picture for the collection, e.g. "ipfs://…". */
  image?: string;
  /** The royalties as in the 777 metadata of the same transaction, repeated for readers of the registration. */
  royalty?: { rate: string; addr: string | string[] };
  /** Of several registrations the one with the highest number counts, so the slot of its transaction is used. */
  nonce: number;
}

/** The registration of a policy's collection, the value of label 867. */
export function policyRegistration({ policyId, scriptCbor, name, description, image, royalty, nonce }: Registration): Metadatum {
  const collection: [number, Metadatum][] = [[0, text(name.trim())]];
  if (description?.trim()) collection.push([1, list(...pieces(description.trim()).map(text))]);
  if (image?.trim()) collection.push([2, list(...pieces(image.trim()).map(text))]);
  const details: [number, Metadatum][] = [[25, map([0, int(1)], [1, map(...collection)])]];
  if (royalty) {
    const address = [royalty.addr].flat().map(text);
    details.push([27, map([0, int(1)], [1, map([1, text(royalty.rate)], [2, list(...address)])])]);
  }
  const payload = map(
    // scope 0: a native script, with its hash and the script itself in pieces
    [1, list(int(0), bytes(policyId), list(...(scriptCbor.match(new RegExp(`.{1,${METADATA_BYTES * 2}}`, "g")) ?? []).map(bytes)))],
    [2, list(...details.map(([cip]) => int(cip)))],
    // validation 1: the beacon token, here the one with the empty name
    [3, list(int(1), list(bytes(policyId), bytes("")))],
    [4, int(nonce)],
    [6, map(...details)]
  );
  // the witnesses stay empty, the mint of the beacon is the proof
  return map([0, int(1)], [1, payload], [2, list()]);
}
