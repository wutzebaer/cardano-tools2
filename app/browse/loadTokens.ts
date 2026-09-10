"use server";

import { getTokenFeed, getTokenSearch } from "@cardano/dbsync";
import { TokenListItem } from "@cardano/types";
import { cip67Label } from "@cardano/utils";
import { CollectionInfo, getCollectionInfos } from "@cardano/wayup";

const PAGE_SIZE = 100;

export type TokenPage = {
  tokens: TokenListItem[];
  collections: Record<string, CollectionInfo>;
  hasMore: boolean;
  cursor?: number | string;
};

async function toPage(page: TokenListItem[], cursor?: number | string): Promise<TokenPage> {
  const tokens = page.filter((token) => cip67Label(token.maName) !== 100);
  const collections = Object.fromEntries(await getCollectionInfos(tokens.map((token) => token.maPolicyId)));
  return {
    tokens,
    collections,
    hasMore: page.length === PAGE_SIZE && cursor != null,
    cursor,
  };
}

export async function loadFeedPage(beforeMintid?: number) {
  const page = await getTokenFeed(beforeMintid);
  return toPage(page, page.at(-1)?.maMintId);
}

export async function loadSearchPage(filter: string, after?: string) {
  const page = await getTokenSearch(filter, after);
  const last = page.at(-1);
  return toPage(page, last ? `${last.maPolicyId}.${last.maName}` : undefined);
}
