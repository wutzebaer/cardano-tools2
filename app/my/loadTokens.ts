"use server";

import { Answer, answer, UserError } from "@cardano/answer";
import { getAddressByHandle, getAddressTokens } from "@cardano/dbsync";
import { TokenListItem } from "@cardano/types";
import { isListed } from "@cardano/technicalToken";
import { CollectionInfo, getCollectionInfos } from "@cardano/wayup";

/** Collection names are looked up one request per policy, so only for the first few. */
const MAX_COLLECTION_LOOKUPS = 40;

export type AddressTokens = {
  address: string;
  tokens: TokenListItem[];
  collections: Record<string, CollectionInfo>;
};

/** Tokens held by a stake address, payment address or `$handle`. */
export async function loadAddressTokens(input: string): Promise<Answer<AddressTokens>> {
  return answer(async () => {
    let address = input.trim();
    if (address.startsWith("$")) {
      const resolved = await getAddressByHandle(address.slice(1).toLowerCase()).catch(() => null);
      if (!resolved?.address) {
        throw new UserError(`The handle ${address} was not found`);
      }
      address = resolved.address;
    }
    const tokens = (
      await getAddressTokens(address).catch(() => {
        throw new UserError(`No tokens for ${address}. Is it a stake address, a payment address or a $handle?`);
      })
    ).filter((token) => isListed(token.maName));
    const policyIds = [...new Set(tokens.map((token) => token.maPolicyId))].slice(0, MAX_COLLECTION_LOOKUPS);
    const collections = Object.fromEntries(await getCollectionInfos(policyIds));
    return { address, tokens, collections };
  });
}
