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

export async function getTokenDetails(policyId: string, assetName: string) {
  return handleRequest(
    client.GET("/token/{policyId}/{assetName}", {
      params: { path: { policyId, assetName } },
    })
  );
}

export async function getAddressTokens(address: string) {
  return handleRequest(
    client.GET("/{address}/token", {
      params: { path: { address } },
    })
  );
}

export async function getStatement(address: string) {
  return handleRequest(
    client.GET("/{address}/statement", {
      params: { path: { address } },
    })
  );
}

export async function getPoolList() {
  return handleRequest(client.GET("/poolList", { next: { revalidate: 3600 } }));
}

export async function getEpochStake(poolHash: string, epoch: number) {
  return handleRequest(
    client.GET("/epochStake/{poolHash}/{epoch}", {
      params: { path: { poolHash, epoch } },
    })
  );
}

export async function getReturnAddresses(stakeAddresses: string[]) {
  return handleRequest(client.POST("/returnAddresses", { body: stakeAddresses }));
}

/** One handle per stake address, stake addresses without a handle are omitted. */
export async function getStakeHandles(stakeAddresses: string[]) {
  return handleRequest(client.POST("/handles", { body: stakeAddresses, next: { revalidate: 60 } }));
}

export async function isTransactionConfirmed(txId: string) {
  return handleRequest(
    client.GET("/transaction/{txId}/confirmed", {
      params: { path: { txId } },
      cache: "no-store",
    })
  );
}

export async function getUtxos(address: string) {
  return handleRequest(
    client.GET("/{address}/utxos", {
      params: { path: { address } },
      cache: "no-store",
    })
  );
}

export async function getAddressByHandle(handle: string) {
  return handleRequest(
    client.GET("/handles/{handle}", {
      params: { path: { handle } },
    })
  );
}
