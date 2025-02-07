import { paths } from "@cardano/dbsync.schema";
import createClient from "openapi-fetch";

const baseUrl = process.env.NODE_ENV === "test" ? "https://cardano-tools.io/cardanoDbSyncApi" : "http://localhost:8080/cardanoDbSyncApi";
const client = createClient<paths>({ baseUrl });

async function handleRequest<T>(request: Promise<{ data?: T; error?: unknown }>): Promise<T> {
  try {
    const response = await request;
    if (response.error) {
      throw response.error;
    }
    return response.data!;
  } catch (e) {
    throw e;
  }
}

export async function getTip() {
  return handleRequest(client.GET("/tip"));
}

export async function getLatestTokens(filter?: string) {
  return handleRequest(
    client.GET("/token", {
      params: { query: { filter } },
      next: { revalidate: 10 },
    })
  );
}

export async function getTokenDetailsByFingerprint(fingerprint: string) {
  return handleRequest(
    client.GET(`/token/{fingerprint}/`, {
      params: {
        path: {
          fingerprint: fingerprint,
        },
      },
      next: { revalidate: 10 },
    })
  );
}
