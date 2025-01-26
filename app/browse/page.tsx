import { getLatestTokens, getTip } from "@cardano/dbsync";
import Token from "@components/Token";


const page = async () => {
  const latestTokens = await getLatestTokens();

  return (
    <div>
      {latestTokens.map((token) => (
        <Token key={token.maFingerprint} tokenListItem={token} />
      ))}
    </div>
  );
};

export default page;
