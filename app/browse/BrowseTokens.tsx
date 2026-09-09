import SearchInput from "@/app/browse/SearchInput";
import { getLatestTokens } from "@cardano/dbsync";
import { getCollectionInfos } from "@cardano/wayup";
import TokenCard from "@components/TokenCard";
import { Suspense } from "react";

export default async function BrowseTokens({ query }: { query?: string }) {
  const latestTokens = await getLatestTokens(query || undefined);
  const collections = await getCollectionInfos(latestTokens!.map((token) => token.maPolicyId));
  return (
    <>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Browse</h1>
          <p className="mt-1 text-sm text-base-content/55">
            {query ? (
              <>
                Results for <span className="font-mono text-base-content/80">{query}</span>
              </>
            ) : (
              "Latest tokens minted on Cardano"
            )}
          </p>
        </div>
        <Suspense>
          <SearchInput />
        </Suspense>
      </div>
      {latestTokens!.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-5">
          {latestTokens!.map((token) => (
            <TokenCard key={token.maMintId} item={token} collection={collections.get(token.maPolicyId)} />
          ))}
        </div>
      ) : (
        <div className="surface px-6 py-16 text-center text-sm text-base-content/55">
          No tokens found.
        </div>
      )}
    </>
  );
}
