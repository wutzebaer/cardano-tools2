/**
 * Attestation hashes for the Cardano token registry (CIP-26), no wallet or serialization library involved.
 *
 * A property is signed as
 *   blake2b-256( h(cbor(subject)) | h(cbor(property name)) | h(cbor(value)) | h(cbor(sequenceNumber)) )
 * with h = blake2b-256. Strings are CBOR text, numbers CBOR unsigned ints and the logo the raw PNG as CBOR bytes.
 */
import { blake2b } from "@noble/hashes/blake2.js";

export type AttestedValue = string | number | Uint8Array;

const hash = (bytes: Uint8Array) => blake2b(bytes, { dkLen: 32 });

function concat(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/** CBOR head: major type plus length or value. */
function cborHead(majorType: number, value: number) {
  const major = majorType << 5;
  if (value < 24) return Uint8Array.of(major | value);
  if (value < 0x100) return Uint8Array.of(major | 24, value);
  if (value < 0x10000) return Uint8Array.of(major | 25, value >> 8, value & 0xff);
  if (value < 0x100000000) return Uint8Array.of(major | 26, value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
  throw new Error("Value too large");
}

export function cborEncode(value: AttestedValue) {
  if (typeof value === "number") {
    return cborHead(0, value);
  }
  if (typeof value === "string") {
    const bytes = new TextEncoder().encode(value);
    return concat(cborHead(3, bytes.length), bytes);
  }
  return concat(cborHead(2, value.length), value);
}

/** The 32 bytes the policy key signs to attest `property = value` for `subject`. */
export function attestationHash(subject: string, property: string, value: AttestedValue, sequenceNumber: number) {
  return hash(concat(hash(cborEncode(subject)), hash(cborEncode(property)), hash(cborEncode(value)), hash(cborEncode(sequenceNumber))));
}
