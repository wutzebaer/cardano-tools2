import SearchInput from "@/app/browse/SearchInput";
import { getLatestTokens } from "@cardano/dbsync";
import Token from "@components/Token";
import { Suspense } from "react";

export default async function BrowseTokens({ query }: { query?: string }) {
  const latestTokens = await getLatestTokens(query || undefined);
  return (
    <>
      <div className="flex justify-center mb-10">
        <Suspense>
          <SearchInput />
        </Suspense>
      </div>
      <div className="flex flex-wrap gap-10 justify-center">
        {latestTokens!.map((token) => (
          <Token key={token.maMintId} item={token} />
        ))}
      </div>
    </>
  );
}
