import SearchInput from "@/app/browse/SearchInput";
import TokenGrid from "@/app/browse/TokenGrid";
import { loadFeedPage, loadSearchPage } from "@/app/browse/loadTokens";
import { Suspense } from "react";

export default async function BrowseTokens({ query }: { query?: string }) {
  const initial = query ? await loadSearchPage(query) : await loadFeedPage();
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
      <TokenGrid key={query ?? "feed"} query={query} initial={initial} />
    </>
  );
}
