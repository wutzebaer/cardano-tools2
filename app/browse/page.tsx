import { getLatestTokens } from "@cardano/dbsync";
import Token from "@components/Token";

export const revalidate = 10
const page = async () => {
  const latestTokens = await getLatestTokens();
  //const latestTokens: components["schemas"]["TokenListItem"][] = await (await fetch('http://localhost:8080/cardanoDbSyncApi/token')).json();

  return (
    <div>
      {latestTokens.map((token) => (
        <Token key={token.maFingerprint} tokenListItem={token} />
      ))}
    </div>
  );
};

export default page;
