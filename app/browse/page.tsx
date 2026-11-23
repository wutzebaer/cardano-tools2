import BrowseTokens from "@/app/browse/BrowseTokens";
import { connection } from "next/server";

export default async function Page() {
  // rendered per visit: a page prerendered during the build, where the API is not reachable,
  // would greet the first visitor after every release with "chain data is not available".
  // The feed itself stays cached for a few seconds by its request.
  await connection();
  return <BrowseTokens />;
}
