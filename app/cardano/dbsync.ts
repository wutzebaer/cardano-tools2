import { components, paths } from "./dbsync.schema";
import createClient from "openapi-fetch";

const baseUrl = process.env.NODE_ENV === "production" ? "https://cardano-tools.io" : "http://localhost:8080";
const client = createClient<paths>({ baseUrl });

export async function getTip() {
  return (await client.GET("/cardanoDbSyncApi/tip")).data!;
}

export async function getLatestTokens() {
  return (await client.GET("/cardanoDbSyncApi/token")).data!;
}

export async function getTokenDetails(tokenListItem: components["schemas"]["TokenListItem"]) {
  return (
    await client.GET(`/cardanoDbSyncApi/token/{policyId}/{assetName}`, {
      params: {
        path: {
          policyId: tokenListItem.maPolicyId,
          assetName: tokenListItem.maName,
        },
      },
    })
  ).data!;
}
