"use server";

import { paths } from "@cardano/dbsync.schema";
import createClient from "openapi-fetch";

const baseUrl = process.env.CARDANO_DBSYNC_API_URL;
const client = createClient<paths>({ baseUrl });

async function handleRequest<T>(request: Promise<{ data?: T; error?: unknown }>): Promise<T> {
  const response = await request;
  if (response.error) {
    throw response.error;
  }
  return response.data!;
}

export async function getTip() {
  return handleRequest(client.GET("/tip"));
}

export async function getStakeInfo(stakeAddress: string) {
  return handleRequest(
    client.GET("/{stakeAddress}/stakeInfo", {
      params: { path: { stakeAddress } },
    })
  );
}

export async function getTokenFeed(beforeMintid?: number, afterMintid?: number) {
  return handleRequest(
    client.GET("/tokenFeed", {
      params: { query: { beforeMintid, afterMintid } },
      next: { revalidate: 10 },
    })
  );
}

export async function getTokenSearch(filter: string, after?: string) {
  return handleRequest(
    client.GET("/tokenSearch", {
      params: { query: { filter: decodeURIComponent(filter), after } },
      querySerializer: { allowReserved: true },
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

export async function getMints(stakeAddress: string) {
  return handleRequest(
    client.GET("/{stakeAddress}/mints", {
      params: { path: { stakeAddress } },
    })
  );
}
