import { getPolicyCollection } from "@cardano/dbsync";
import { IS_MAINNET } from "@cardano/network";

export type CollectionInfo = {
  name?: string | null;
  handle?: string | null;
  verified?: boolean;
  /** What the owner registered on chain about the collection (CIP-88). */
  about?: string;
  /** The picture the owner registered on chain, on IPFS. */
  picture?: string;
};

/** What is known about a collection: from the marketplace, and without a name there the one its owner registered on chain. */
export async function getCollectionInfo(policyId: string): Promise<CollectionInfo> {
  const [market, registered] = await Promise.all([marketCollectionInfo(policyId).catch((): CollectionInfo => ({})), getPolicyCollection(policyId)]);
  if (!registered) return market;
  return { ...market, name: market.name || registered.name, about: registered.description, picture: registered.image };
}

async function marketCollectionInfo(policyId: string): Promise<CollectionInfo> {
  // the marketplace only knows mainnet collections
  if (!IS_MAINNET) {
    return {};
  }
  const input = encodeURIComponent(JSON.stringify({ "0": { identifier: policyId } }));
  const response = await fetch(
    `https://prod.api.ada-anvil.app/marketplace/trpc/getCollection?batch=1&input=${input}`,
    { next: { revalidate: 10 } }
  );
  if (!response.ok) {
    return {};
  }
  const payload = await response.json();
  return payload?.[0]?.result?.data ?? {};
}

export async function getCollectionInfos(policyIds: string[]): Promise<Map<string, CollectionInfo>> {
  const unique = [...new Set(policyIds)];
  const entries = await Promise.all(unique.map(async (id) => [id, await getCollectionInfo(id)] as const));
  return new Map(entries);
}
