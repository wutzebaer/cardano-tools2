import SearchInput from "@/app/browse/SearchInput";
import { getLatestTokens } from "@cardano/dbsync";
import Token from "@components/Token";

export const revalidate = 10

interface PageProps {
  searchParams: { query?: string };
}

const page = async ({ searchParams }: PageProps) => {
  const { query } = await searchParams;
  const latestTokens = await getLatestTokens(query);
  return (
    <>
      <div className="flex justify-center mb-10">
        <SearchInput />
      </div>
      <div className="flex flex-wrap gap-10 justify-center">
        {latestTokens!.map((token) => (
          <Token key={token.maMintId} fingerprint={token.maFingerprint} />
        ))}
      </div>
    </>
  );
};

export default page;
