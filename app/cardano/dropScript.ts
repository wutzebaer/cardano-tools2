/**
 * The data of an NFT drop, no wallet or serialization library involved.
 *
 * A drop sells the tokens of a list and mints each one only when it is bought. The contract (contracts/drop) keeps
 * the Merkle root of the list on chain, the list itself is published elsewhere. Everything here has to produce
 * exactly the bytes the contract computes: the leaves, the datum of the metadata and the script with its parameters.
 */
import { blake2b } from "@noble/hashes/blake2.js";
import type { MetaValue } from "./metadata";

// ---------------------------------------------------------------------------
// Plutus data
// ---------------------------------------------------------------------------

export class Constr {
  index: number;
  fields: PlutusValue[];
  constructor(index: number, fields: PlutusValue[]) {
    this.index = index;
    this.fields = fields;
  }
}

/** Integers as bigint, byte strings as hex. */
export type PlutusValue = bigint | string | PlutusValue[] | Map<PlutusValue, PlutusValue> | Constr;

const toHex = (bytes: Uint8Array | number[]) => Buffer.from(bytes).toString("hex");
const fromHex = (hex: string) => Uint8Array.from(Buffer.from(hex, "hex"));
export const utf8Hex = (text: string) => Buffer.from(text, "utf8").toString("hex");
export const hexUtf8 = (hex: string) => Buffer.from(hex, "hex").toString("utf8");

function cborHead(major: number, value: bigint | number) {
  const n = BigInt(value);
  const type = major << 5;
  if (n < 24n) return toHex([type | Number(n)]);
  for (const [bytes, code] of [[1, 24], [2, 25], [4, 26], [8, 27]] as const) {
    if (n < 1n << BigInt(bytes * 8)) return toHex([type | code]) + n.toString(16).padStart(bytes * 2, "0");
  }
  throw new Error("Number too large");
}

/**
 * Plutus data as the chain writes it: lists open-ended, maps with their length and in the given order, byte strings
 * over 64 bytes in pieces. The contract hashes the metadata in this form, so the list has to be hashed in it too.
 */
export function plutusCbor(data: PlutusValue): string {
  const list = (items: PlutusValue[]) => (items.length ? "9f" + items.map(plutusCbor).join("") + "ff" : "80");
  if (typeof data === "bigint") return data >= 0n ? cborHead(0, data) : cborHead(1, -1n - data);
  if (typeof data === "string") {
    if (data.length <= 128) return cborHead(2, data.length / 2) + data;
    let pieces = "";
    for (let at = 0; at < data.length; at += 128) {
      const piece = data.slice(at, at + 128);
      pieces += cborHead(2, piece.length / 2) + piece;
    }
    return "5f" + pieces + "ff";
  }
  if (Array.isArray(data)) return list(data);
  if (data instanceof Map) return cborHead(5, data.size) + [...data].map(([key, value]) => plutusCbor(key) + plutusCbor(value)).join("");
  if (data.index < 7) return toHex([0xd8, 0x79 + data.index]) + list(data.fields);
  if (data.index < 128) return toHex([0xd9, 0x05, 0x00 + data.index - 7]) + list(data.fields);
  throw new Error("Unsupported constructor");
}

/** Reads Plutus data from CBOR in any of the forms tools write it. */
export function plutusFromCbor(hex: string): PlutusValue {
  const bytes = fromHex(hex);
  let at = 0;
  const argument = (info: number): bigint => {
    if (info < 24) return BigInt(info);
    const length = 1 << (info - 24);
    let value = 0n;
    for (let i = 0; i < length; i++) value = (value << 8n) | BigInt(bytes[at++]);
    return value;
  };
  const items = (info: number, read: () => void) => {
    if (info === 31) {
      while (bytes[at] !== 0xff) read();
      at++;
    } else {
      for (let count = argument(info); count > 0n; count--) read();
    }
  };
  const read = (): PlutusValue => {
    const first = bytes[at++];
    if (first === undefined) throw new Error("Datum ends early");
    const major = first >> 5;
    const info = first & 31;
    if (major === 0) return argument(info);
    if (major === 1) return -1n - argument(info);
    if (major === 2) {
      if (info !== 31) {
        const length = Number(argument(info));
        at += length;
        return toHex(bytes.subarray(at - length, at));
      }
      let joined = "";
      items(info, () => (joined += read() as string));
      return joined;
    }
    if (major === 4) {
      const list: PlutusValue[] = [];
      items(info, () => list.push(read()));
      return list;
    }
    if (major === 5) {
      const map = new Map<PlutusValue, PlutusValue>();
      items(info, () => map.set(read(), read()));
      return map;
    }
    if (major === 6) {
      const tag = Number(argument(info));
      if (tag >= 121 && tag <= 127) return new Constr(tag - 121, read() as PlutusValue[]);
      if (tag >= 1280 && tag <= 1400) return new Constr(tag - 1280 + 7, read() as PlutusValue[]);
      if (tag === 2 || tag === 3) {
        const magnitude = BigInt("0x" + ((read() as string) || "0"));
        return tag === 2 ? magnitude : -1n - magnitude;
      }
    }
    throw new Error("Not Plutus data");
  };
  return read();
}

const blake2b256 = (hex: string) => toHex(blake2b(fromHex(hex), { dkLen: 32 }));

// ---------------------------------------------------------------------------
// The list of tokens and its Merkle tree, the rules of contracts/drop/lib/drop/merkle.ak
// ---------------------------------------------------------------------------

/** One token of a drop: its on-chain name without the CIP-67 label and its CIP-68 metadata. */
export interface DropToken {
  assetName: string;
  metadata: Record<string, MetaValue>;
}

/** The list as it is published. Its order is the numbering of the tokens. */
export interface DropList {
  version: 1;
  tokens: DropToken[];
}

export const DROP_NAME_MAX_BYTES = 28;
/**
 * Bytes the metadata of one token may have as it is written on chain. A purchase carries it, next to the contract
 * and the proof, in a transaction of 16 kB at most, with room left for what the wallet of the buyer adds.
 */
export const MAX_METADATA_BYTES = 8000;
export const MAX_DROP_TOKENS = 10000;

export const REFERENCE_LABEL = "000643b0";
export const USER_LABEL = "000de140";

function metadataValue(value: MetaValue): PlutusValue {
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return utf8Hex(value);
  if (Array.isArray(value)) return value.map(metadataValue);
  return new Map(Object.entries(value).map(([key, item]) => [utf8Hex(key), metadataValue(item)]));
}

/** The CIP-68 datum that goes next to the reference token of a drop token. */
export const metadataDatum = (token: DropToken) => plutusCbor(new Constr(0, [metadataValue(token.metadata), 1n]));

const leaf = (nameHex: string, metadataHash: string) => blake2b256("00" + metadataHash + nameHex);
const node = (left: string, right: string) => blake2b256("01" + left + right);
const levelUp = (hashes: string[]) => hashes.flatMap((hash, index) => (index % 2 ? [] : [node(hash, hashes[index + 1])]));

/** All levels of the tree, the leaves first, filled up to a power of two. */
export function merkleTree(tokens: DropToken[]): string[][] {
  const leaves = tokens.map((token) => leaf(utf8Hex(token.assetName), blake2b256(metadataDatum(token))));
  let size = 1;
  while (size < leaves.length) size *= 2;
  const levels = [leaves.concat(Array(size - leaves.length).fill("00".repeat(32)))];
  while (levels[levels.length - 1].length > 1) levels.push(levelUp(levels[levels.length - 1]));
  return levels;
}

export const merkleRoot = (tree: string[][]) => tree[tree.length - 1][0];

/** The siblings of token `index` from bottom to top. */
export function merkleProof(tree: string[][], index: number): string[] {
  const proof: string[] = [];
  for (let level = 0; level < tree.length - 1; level++) {
    proof.push(tree[level][index ^ 1]);
    index >>= 1;
  }
  return proof;
}

/** Bytes of the metadata of a token as it is written on chain, undefined if it cannot be written. */
function metadataBytes(token: DropToken) {
  try {
    return metadataDatum(token).length / 2;
  } catch {
    return undefined;
  }
}

/** Why a list cannot be sold as it is, in words for whoever uploads it. Empty if it is fine. */
export function listErrors(tokens: DropToken[]): string[] {
  const errors: string[] = [];
  if (tokens.length === 0) return ["The list is empty"];
  if (tokens.length > MAX_DROP_TOKENS) errors.push(`A drop holds at most ${MAX_DROP_TOKENS} tokens, this list has ${tokens.length}`);
  const seen = new Set<string>();
  for (const [index, token] of tokens.entries()) {
    const where = `Token ${index + 1}`;
    const bytes = Buffer.from(token.assetName ?? "", "utf8").length;
    if (bytes === 0 || bytes > DROP_NAME_MAX_BYTES) errors.push(`${where}: the asset name must be 1 to ${DROP_NAME_MAX_BYTES} bytes`);
    else if (seen.has(token.assetName)) errors.push(`${where}: the asset name ${token.assetName} is used twice`);
    seen.add(token.assetName);
    if (token.metadata == null || typeof token.metadata !== "object" || Array.isArray(token.metadata)) errors.push(`${where}: no metadata`);
    else if (typeof token.metadata.name !== "string" || !token.metadata.name) errors.push(`${where}: the metadata needs a name`);
    else {
      // a token with more could never be bought, which nobody would notice before somebody tries
      const bytes = metadataBytes(token);
      if (bytes === undefined) errors.push(`${where}: the metadata holds a value that cannot be written on chain, only texts, whole numbers, lists and objects can`);
      else if (bytes > MAX_METADATA_BYTES) errors.push(`${where}: the metadata is too large to be bought, ${bytes.toLocaleString("en")} bytes of at most ${MAX_METADATA_BYTES.toLocaleString("en")}`);
    }
    if (errors.length >= 8) return [...errors, "…"];
  }
  return errors;
}

/**
 * Reads a list a creator uploads: the published form, a plain array of tokens, or an object with one entry per
 * asset name, which is what the JSON editor of the mint page writes.
 */
export function parseDropList(json: unknown): DropToken[] {
  const tokens = Array.isArray(json) ? json : json && typeof json === "object" && Array.isArray((json as DropList).tokens) ? (json as DropList).tokens : undefined;
  if (tokens) {
    return tokens.map((token) => ({ assetName: String(token?.assetName ?? ""), metadata: token?.metadata as Record<string, MetaValue> }));
  }
  if (json && typeof json === "object") {
    return Object.entries(json as Record<string, unknown>).map(([assetName, metadata]) => ({ assetName, metadata: metadata as Record<string, MetaValue> }));
  }
  throw new Error("The file is not a list of tokens");
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

/** All groups are created by one transaction, and more than these do not fit into it. */
export const MAX_GROUPS = 32;

/** Name of the marker token of a group. */
export const markerName = (group: number) => utf8Hex("grp") + group.toString(16).padStart(4, "0");

/** The group a marker token names, undefined for any other token name. */
export function groupOfMarker(nameHex: string) {
  return nameHex.length === 10 && nameHex.startsWith(utf8Hex("grp")) ? parseInt(nameHex.slice(6), 16) : undefined;
}

export const groupOfToken = (index: number, groups: number) => index % groups;
export const positionOfToken = (index: number, groups: number) => Math.floor(index / groups);
export const sizeOfGroup = (total: number, groups: number, group: number) => Math.floor((total - group + groups - 1) / groups);
export const freshSold = (total: number, groups: number, group: number) => "00".repeat(Math.ceil(sizeOfGroup(total, groups, group) / 8));

export function isSold(sold: string, position: number) {
  return (parseInt(sold.slice((position >> 3) * 2, (position >> 3) * 2 + 2), 16) & (0x80 >> (position & 7))) !== 0;
}

export function tickSold(sold: string, position: number) {
  const bytes = fromHex(sold);
  bytes[position >> 3] |= 0x80 >> (position & 7);
  return toHex(bytes);
}

/**
 * How many groups a drop of this size gets unless its creator says otherwise. Purchases in one group wait for each
 * other, so more groups mean fewer collisions, and each group binds a deposit until the drop is closed.
 */
export function suggestedGroups(total: number) {
  return Math.max(1, Math.min(total, MAX_GROUPS, Math.round(Math.sqrt(total))));
}

// ---------------------------------------------------------------------------
// What the contract reads and writes
// ---------------------------------------------------------------------------

export interface OutputReference {
  txHash: string;
  index: number;
}

/** A payment credential and an optional stake credential, each the hash of a key or of a script. */
export interface AddressParts {
  payment: { keyHash: string } | { scriptHash: string };
  stake?: { keyHash: string } | { scriptHash: string };
}

export interface DropConfig {
  root: string;
  total: number;
  groups: number;
  /** Price of one token in lovelace */
  price: bigint;
  seller: AddressParts;
  /** Payment key hash of who may close the drop */
  owner: string;
  seed: OutputReference;
  burnable: boolean;
  /** Where the list is published, e.g. ipfs://… */
  list: string;
}

const boolData = (value: boolean) => new Constr(value ? 1 : 0, []);
const seedData = (seed: OutputReference) => new Constr(0, [seed.txHash, BigInt(seed.index)]);
const credentialData = (credential: { keyHash: string } | { scriptHash: string }) =>
  "keyHash" in credential ? new Constr(0, [credential.keyHash]) : new Constr(1, [credential.scriptHash]);
const credentialOf = (data: Constr) => (data.index === 0 ? { keyHash: data.fields[0] as string } : { scriptHash: data.fields[0] as string });

export function configData(config: DropConfig): Constr {
  const stake = config.seller.stake ? new Constr(0, [new Constr(0, [credentialData(config.seller.stake)])]) : new Constr(1, []);
  return new Constr(0, [
    config.root,
    BigInt(config.total),
    BigInt(config.groups),
    config.price,
    new Constr(0, [credentialData(config.seller.payment), stake]),
    config.owner,
    seedData(config.seed),
    boolData(config.burnable),
    utf8Hex(config.list),
  ]);
}

function configOf(data: PlutusValue): DropConfig {
  const fields = (data as Constr).fields;
  const [payment, stake] = (fields[4] as Constr).fields as Constr[];
  const seed = (fields[6] as Constr).fields;
  const pointer = stake.index === 0 ? (stake.fields[0] as Constr) : undefined;
  return {
    root: fields[0] as string,
    total: Number(fields[1]),
    groups: Number(fields[2]),
    price: fields[3] as bigint,
    seller: { payment: credentialOf(payment), ...(pointer?.index === 0 ? { stake: credentialOf(pointer.fields[0] as Constr) } : {}) },
    owner: fields[5] as string,
    seed: { txHash: seed[0] as string, index: Number(seed[1]) },
    burnable: (fields[7] as Constr).index === 1,
    list: hexUtf8(fields[8] as string),
  };
}

/** The state of one group as its datum says it. */
export interface GroupState {
  config: DropConfig;
  group: number;
  sold: string;
}

export const groupDatum = (state: GroupState) => plutusCbor(new Constr(0, [configData(state.config), BigInt(state.group), state.sold]));

/** Reads the datum of a group, undefined if the datum is something else (e.g. the metadata of a token). */
export function groupOfDatum(datumHex: string): GroupState | undefined {
  try {
    const data = plutusFromCbor(datumHex);
    if (!(data instanceof Constr) || data.index !== 0 || data.fields.length !== 3 || typeof data.fields[2] !== "string") return undefined;
    const config = data.fields[0];
    if (!(config instanceof Constr) || config.fields.length !== 9) return undefined;
    return { config: configOf(config), group: Number(data.fields[1]), sold: data.fields[2] };
  } catch {
    return undefined;
  }
}

export const REDEEMER = {
  create: (config: DropConfig) => plutusCbor(new Constr(0, [configData(config)])),
  withOutput: plutusCbor(new Constr(1, [])),
  burn: plutusCbor(new Constr(2, [])),
  buy: (index: number, assetName: string, proof: string[]) => plutusCbor(new Constr(0, [BigInt(index), utf8Hex(assetName), proof])),
  close: plutusCbor(new Constr(1, [])),
  reclaim: plutusCbor(new Constr(2, [])),
};

// ---------------------------------------------------------------------------
// The script of one drop
// ---------------------------------------------------------------------------

class Bits {
  bytes: number[] = [];
  used = 0;
  push(value: number, count: number) {
    for (let bit = count - 1; bit >= 0; bit--) {
      if (this.used % 8 === 0) this.bytes.push(0);
      if ((value >> bit) & 1) this.bytes[this.bytes.length - 1] |= 0x80 >> (this.used % 8);
      this.used++;
    }
  }
  /** Flat's filler: zeros and a one up to the next full byte, a whole byte if already there. */
  pad() {
    while (this.used % 8 !== 7) this.push(0, 1);
    this.push(1, 1);
  }
}

/**
 * The drop contract with its two parameters applied, as the CBOR byte string that goes on chain.
 *
 * The compiled contract is a function of the parameters in the flat encoding. Applying wraps it in one application
 * per parameter: `[[contract seed] burnable]`. Where the contract's own bits end is not written in the encoding,
 * so `termBits` comes along with the compiled code (see dropBlueprint.ts).
 */
export function applyDropParams(codeHex: string, termBits: number, seed: OutputReference, burnable: boolean): string {
  const params = [seedData(seed), boolData(burnable)];
  const code = fromHex(codeHex);
  const bits = new Bits();
  for (const byte of code.subarray(0, 3)) bits.push(byte, 8); // version
  for (let i = 0; i < params.length; i++) bits.push(0b0011, 4); // apply
  for (let bit = 0; bit < termBits; bit++) bits.push((code[3 + (bit >> 3)] >> (7 - (bit & 7))) & 1, 1);
  for (const param of params) {
    bits.push(0b0100, 4); // constant
    bits.push(0b110000, 6); // of type data
    bits.pad();
    const data = fromHex(plutusCbor(param));
    for (let at = 0; at < data.length; at += 255) {
      const chunk = data.subarray(at, at + 255);
      bits.push(chunk.length, 8);
      for (const byte of chunk) bits.push(byte, 8);
    }
    bits.push(0, 8);
  }
  bits.pad();
  return cborHead(2, bits.bytes.length) + toHex(bits.bytes);
}

/** Hash of a Plutus V3 script, which is the policy id and the payment credential of its address. */
export const scriptHash = (scriptCborHex: string) => toHex(blake2b(fromHex("03" + scriptCborHex), { dkLen: 28 }));
