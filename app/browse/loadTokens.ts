"use server";

import { getTokenFeed, getTokenSearch } from "@cardano/dbsync";
import { TokenListItem } from "@cardano/types";
import { isListed } from "@cardano/technicalToken";
import { CollectionInfo, getCollectionInfos } from "@cardano/wayup";

const PAGE_SIZE = 100;

export type TokenPage = {
  tokens: TokenListItem[];
  collections: Record<string, CollectionInfo>;
  hasMore: boolean;
  cursor?: number | string;
  newestMintId?: number;
};

async function toPage(page: TokenListItem[], cursor?: number | string): Promise<TokenPage> {
  const tokens = page.filter((token) => isListed(token.maName));
  const collections = Object.fromEntries(await getCollectionInfos(tokens.map((token) => token.maPolicyId)));
  return {
    tokens,
    collections,
    hasMore: page.length === PAGE_SIZE && cursor != null,
    cursor,
    newestMintId: page[0]?.maMintId,
  };
}

export async function loadFeedPage(beforeMintid?: number, afterMintid?: number) {
  const page = await getTokenFeed(beforeMintid, afterMintid);
  return toPage(page, page.at(-1)?.maMintId);
}

export async function loadSearchPage(filter: string, after?: string) {
  const page = await getTokenSearch(filter, after);
  const last = page.at(-1);
  return toPage(page, last ? `${last.maPolicyId}.${last.maName}` : undefined);
}
