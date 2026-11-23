"use server";

import { getStakeHandles } from "@cardano/dbsync";

/** The API resolves at most this many stake addresses per request. */
const HANDLE_CHUNK = 5000;
/** A page never shows more addresses than this, larger requests are not answered. */
const MAX_ADDRESSES = 20000;

/**
 * ADA Handles of stake addresses, keyed by stake address and without the leading "$".
 * Handles are decoration: without chain data the result is empty instead of an error.
 */
export async function loadHandles(stakeAddresses: string[]): Promise<Record<string, string>> {
  const handles: Record<string, string> = {};
  if (stakeAddresses.length > MAX_ADDRESSES) {
    return handles;
  }
  try {
    for (let i = 0; i < stakeAddresses.length; i += HANDLE_CHUNK) {
      for (const { stakeAddress, handle } of await getStakeHandles(stakeAddresses.slice(i, i + HANDLE_CHUNK))) {
        handles[stakeAddress] = handle;
      }
    }
  } catch {
    return {};
  }
  return handles;
}
