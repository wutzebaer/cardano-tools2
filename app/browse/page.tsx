import { getLatestTokens } from "@cardano/dbsync";
import ErrorBoundary from "@components/ErrorBoundary";
import Token from "@components/Token";

export const revalidate = 10

const page = async () => {
  const latestTokens = (await getLatestTokens());
  return (
    <>
      <h1 className="text-2xl font-bold mb-10">Browse</h1>
      <div className="flex flex-wrap gap-10 justify-center">
        {latestTokens!.map((token) => (
          <Token key={token.maFingerprint} tokenListItem={token} />
        ))}
      </div>
    </>
  );
};

export default page;
