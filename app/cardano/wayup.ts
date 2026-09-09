export type CollectionInfo = {
  name?: string | null;
  handle?: string | null;
  verified?: boolean;
};

export async function getCollectionInfo(policyId: string): Promise<CollectionInfo> {
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
