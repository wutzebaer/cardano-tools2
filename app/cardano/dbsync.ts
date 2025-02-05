import { components, paths } from "@cardano/dbsync.schema";
import { errorToMessage } from "@cardano/utils";
import createClient from "openapi-fetch";

const baseUrl = process.env.NODE_ENV === "test" ? "https://cardano-tools.io/cardanoDbSyncApi" : "http://localhost:8080/cardanoDbSyncApi";
const client = createClient<paths>({ baseUrl });

export async function getTip() {
  return (await client.GET("/tip")).data!;
}

export async function getLatestTokens(filter?: string) {
  const tokenResponse = await client.GET("/token", { params: { query: { filter } } });
  const e: Error = tokenResponse.error as unknown as Error;
  if (e) {
    throw new Error(errorToMessage(e));
  }
  return tokenResponse.data!;
}

export async function getTokenDetails(tokenListItem: components["schemas"]["TokenListItem"]) {
  return (
    await client.GET(`/token/{policyId}/{assetName}`, {
      params: {
        path: {
          policyId: tokenListItem.maPolicyId,
          assetName: tokenListItem.maName,
        },
      },
    })
  ).data!;
}
