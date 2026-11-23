import type { TokenListItem } from "../cardano/types";

/** A policy shows up as one collection entry once this many of its tokens are in the feed. */
export const MIN_COLLECTION_SIZE = 3;

export type FeedEntry = { kind: "token"; token: TokenListItem } | { kind: "collection"; policyId: string; tokens: TokenListItem[] };

/**
 * Collapses the tokens of a policy into one entry, so a collection that mints hundreds of tokens does not
 * push everything else out of the feed. The entry takes the place of the policy's first token in the list.
 * Policies with only a few tokens keep their single entries, one per token however often it is minted.
 */
export function groupFeed(tokens: TokenListItem[], minSize = MIN_COLLECTION_SIZE): FeedEntry[] {
  // the same token can be minted more than once, it counts once per collection
  const byPolicy = new Map<string, Map<string, TokenListItem>>();
  for (const token of tokens) {
    const ofPolicy = byPolicy.get(token.maPolicyId) ?? new Map<string, TokenListItem>();
    if (!ofPolicy.has(token.maFingerprint)) {
      ofPolicy.set(token.maFingerprint, token);
    }
    byPolicy.set(token.maPolicyId, ofPolicy);
  }

  const entries: FeedEntry[] = [];
  const collected = new Set<string>();
  for (const token of tokens) {
    const ofPolicy = byPolicy.get(token.maPolicyId)!;
    if (ofPolicy.size < minSize) {
      // a token that is minted again and again shows up once, at its latest mint
      if (ofPolicy.get(token.maFingerprint) === token) entries.push({ kind: "token", token });
    } else if (!collected.has(token.maPolicyId)) {
      collected.add(token.maPolicyId);
      entries.push({ kind: "collection", policyId: token.maPolicyId, tokens: [...ofPolicy.values()] });
    }
  }
  return entries;
}
