"use server";

import { getAddressByHandle, getAddressTokens } from "@cardano/dbsync";
import { TokenListItem } from "@cardano/types";
import { cip67Label } from "@cardano/utils";
import { CollectionInfo, getCollectionInfos } from "@cardano/wayup";

/** Collection names are looked up one request per policy, so only for the first few. */
const MAX_COLLECTION_LOOKUPS = 40;

export type AddressTokens = {
  address: string;
  tokens: TokenListItem[];
  collections: Record<string, CollectionInfo>;
};

/** Tokens held by a stake address, payment address or `$handle`. */
export async function loadAddressTokens(input: string): Promise<AddressTokens> {
  let address = input.trim();
  if (address.startsWith("$")) {
    const resolved = await getAddressByHandle(address.slice(1).toLowerCase());
    if (!resolved?.address) {
      throw new Error(`Handle ${address} not found`);
    }
    address = resolved.address;
  }
  const tokens = (await getAddressTokens(address)).filter((token) => cip67Label(token.maName) !== 100);
  const policyIds = [...new Set(tokens.map((token) => token.maPolicyId))].slice(0, MAX_COLLECTION_LOOKUPS);
  const collections = Object.fromEntries(await getCollectionInfos(policyIds));
  return { address, tokens, collections };
}
