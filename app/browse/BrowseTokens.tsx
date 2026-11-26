import SearchInput from "@/app/browse/SearchInput";
import TokenGrid from "@/app/browse/TokenGrid";
import { loadFeedPage, loadSearchPage } from "@/app/browse/loadTokens";
import { Notice } from "@components/ui";
import { Suspense } from "react";

export default async function BrowseTokens({ query }: { query?: string }) {
  // without the API the page still renders, so a build or a visit does not fail with it
  const initial = await (query ? loadSearchPage(query) : loadFeedPage()).catch(() => null);
  return (
    <>
      <div className="mb-5 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-5">
        <div className="min-w-0">
          <h1 className="text-brand text-2xl font-semibold tracking-tight">Browse</h1>
          <p className="mt-1 text-sm text-base-content/55">
            {query ? (
              <>
                Results for <span className="break-all font-mono text-base-content/80">{query}</span>
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
      {initial ? <TokenGrid key={query ?? "feed"} query={query} initial={initial} /> : <Notice tone="warning">Chain data is not available at the moment. Please try again in a few minutes.</Notice>}
    </>
  );
}
