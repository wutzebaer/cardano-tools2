import SearchInput from "@/app/browse/SearchInput";
import { getLatestTokens } from "@cardano/dbsync";
import Token from "@components/Token";
import { Suspense } from "react";

export const revalidate = 10
export const generateStaticParams = async () => {
  return [];
};

const SearchPage = async ({ params }: { params: Promise<{ query?: string }> }) => {
  const { query } = await params;
  const latestTokens = await getLatestTokens(query);
  return (
    <>
      <div className="flex justify-center mb-10">
        <Suspense>
          <SearchInput />
        </Suspense>
      </div>
      <div className="flex flex-wrap gap-10 justify-center">
        {latestTokens!.map((token) => (
          <Token key={token.maMintId} fingerprint={token.maFingerprint} />
        ))}
      </div>
    </>
  );
};

export default SearchPage;
