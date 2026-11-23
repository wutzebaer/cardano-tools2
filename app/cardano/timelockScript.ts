/**
 * The script of a timelock and the dates it can end on, no wallet or serialization library involved.
 *
 * A timelock is the native script `all [sig keyHash, after slot]`: only the owner of the key can spend, and only
 * from the slot on. Nothing about a lock is stored anywhere. Locks always end at midnight UTC, so the few
 * thousand scripts a wallet key could have locked with can simply be tried against the addresses found on chain.
 */
import { blake2b } from "@noble/hashes/blake2.js";

export const DAY_SECONDS = 86400;

/** Longest time a lock can run. Raising it is safe, lowering it would hide existing locks. */
export const MAX_LOCK_DAYS = 3660;

/** Midnight UTC of the day the feature went live, no lock ends before it. */
export const FIRST_UNLOCK_UNIX = Date.UTC(2026, 10, 23) / 1000;

function cborUint(value: number) {
  if (value < 24) return [value];
  if (value < 0x100) return [0x18, value];
  if (value < 0x10000) return [0x19, value >> 8, value & 0xff];
  if (value < 0x100000000) return [0x1a, (value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
  const high = Math.floor(value / 0x100000000);
  const low = value >>> 0;
  return [0x1b, (high >>> 24) & 0xff, (high >>> 16) & 0xff, (high >>> 8) & 0xff, high & 0xff, (low >>> 24) & 0xff, (low >>> 16) & 0xff, (low >>> 8) & 0xff, low & 0xff];
}

/**
 * Hash of the native script `all [sig keyHash, after|before slot]`, which is the payment credential of its address
 * (and the policy id if it is used for minting): blake2b-224 over a zero byte and the script's CBOR.
 */
export function timeScriptHash(keyHash: string, bound: "after" | "before", slot: number) {
  const key = Buffer.from(keyHash, "hex");
  if (key.length !== 28) throw new Error("A key hash has 28 bytes");
  // [1, [[0, keyHash], [4 | 5, slot]]]
  const bytes = Uint8Array.from([0x00, 0x82, 0x01, 0x82, 0x82, 0x00, 0x58, 0x1c, ...key, 0x82, bound === "after" ? 0x04 : 0x05, ...cborUint(slot)]);
  return Buffer.from(blake2b(bytes, { dkLen: 28 })).toString("hex");
}

/** Unix time of midnight UTC of a `YYYY-MM-DD` date, undefined if it is not a date. */
export function unlockUnixOfDate(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return undefined;
  const unix = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 1000;
  // Date.UTC rolls an impossible day over into the next month
  return new Date(unix * 1000).toISOString().slice(0, 10) === isoDate ? unix : undefined;
}

/** Every time a lock that exists at `nowUnix` can end: the midnights from the first day to the longest lock made today. */
export function candidateUnlockTimes(nowUnix: number) {
  const last = Math.floor(nowUnix / DAY_SECONDS) * DAY_SECONDS + (MAX_LOCK_DAYS + 1) * DAY_SECONDS;
  const times: number[] = [];
  for (let unix = FIRST_UNLOCK_UNIX; unix <= last; unix += DAY_SECONDS) {
    times.push(unix);
  }
  return times;
}

/** Why a lock cannot end on this date, undefined if it can. */
export function unlockDateError(isoDate: string, nowUnix: number) {
  const unix = unlockUnixOfDate(isoDate);
  if (unix == null) return "Pick a date";
  if (unix <= nowUnix) return "Must be in the future";
  return unix > nowUnix + MAX_LOCK_DAYS * DAY_SECONDS ? `At most ${MAX_LOCK_DAYS} days ahead` : undefined;
}
