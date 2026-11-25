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

/** The CIP-27 royalties of a policy, or null if it defines none (the API answers with an empty body then). */
export async function getPolicyRoyalties(policyId: string) {
  try {
    const royalties = await handleRequest(
      client.GET("/policy/{policyId}/royalties", {
        params: { path: { policyId } },
        next: { revalidate: 60 },
      })
    );
    return royalties?.rate ? royalties : null;
  } catch {
    return null;
  }
}

interface TokenHolder {
  /** Stake address of the holder, or the address itself where it has no stake part, as that of a contract */
  address: string;
  quantity: number;
}

/**
 * Who holds a token right now, the largest holders first. Empty where nobody does or the answer is missing.
 * The token without an asset name cannot be asked for.
 */
export async function getTokenHolders(policyId: string, assetName: string): Promise<TokenHolder[]> {
  try {
    if (!/^[0-9a-f]{56}$/.test(policyId) || !/^([0-9a-f]{2})+$/.test(assetName)) return [];
    const response = await fetch(`${baseUrl}/token/${policyId}/${assetName}/holders`, { next: { revalidate: 60 } });
    const holders = response.ok ? await response.json() : [];
    return Array.isArray(holders) ? holders.filter((holder) => typeof holder?.address === "string" && typeof holder?.quantity === "number") : [];
  } catch {
    return [];
  }
}

/** What the owner of a policy registered about its collection on chain (CIP-88), or null. Nobody checked any of it. */
export async function getPolicyCollection(policyId: string): Promise<{ name: string; description?: string; image?: string } | null> {
  try {
    if (!/^[0-9a-f]{56}$/.test(policyId)) return null;
    const response = await fetch(`${baseUrl}/policy/${policyId}/collection`, { next: { revalidate: 60 } });
    // the API answers with an empty body if there is none
    const collection = response.ok ? JSON.parse((await response.text()) || "null") : null;
    if (typeof collection?.name !== "string" || !collection.name.trim()) return null;
    return {
      name: collection.name.trim(),
      description: typeof collection.description === "string" && collection.description.trim() ? collection.description.trim().slice(0, 1000) : undefined,
      // only from IPFS: any other address would let the owner of a policy see who looks at its collection
      image: typeof collection.image === "string" && /^ipfs:\/\/[A-Za-z0-9]{40,100}$/.test(collection.image) ? collection.image : undefined,
    };
  } catch {
    return null;
  }
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

/** The metadata values of a transaction as a JSON array, without their labels. Empty for a transaction without metadata. */
export async function getTransactionMetadata(txId: string) {
  return handleRequest(
    client.GET("/transaction/{txId}/metadata", {
      params: { path: { txId } },
      parseAs: "text",
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

/** The API answers an unknown address or pool with an empty body, which reads as nothing here. */
async function optional<T>(request: Promise<{ data?: T; error?: unknown }>): Promise<T | null> {
  try {
    const data = await handleRequest(request);
    return data && typeof data === "object" ? data : null;
  } catch {
    return null;
  }
}

/** Stake address of a payment address, null if it has none or is unknown. */
export async function getStakeAddress(address: string) {
  return (await optional(client.GET("/{address}/stakeAddress", { params: { path: { address } } })))?.address ?? null;
}

/** Registration, pool, DRep and withdrawable rewards of a stake address, null if the chain does not know it. */
export async function getStakeCheck(stakeAddress: string) {
  return optional(client.GET("/{stakeAddress}/stakeCheck", { params: { path: { stakeAddress } }, cache: "no-store" }));
}

export async function getPoolCheck(poolHash: string) {
  return optional(client.GET("/pool/{poolHash}/check", { params: { path: { poolHash } }, next: { revalidate: 300 } }));
}

/** Blocks and returns of a pool over the last epochs. Slow for very large pools on the first call of an hour. */
export async function getPoolPerformance(poolHash: string) {
  return optional(client.GET("/pool/{poolHash}/performance", { params: { path: { poolHash } }, next: { revalidate: 3600 } }));
}

export async function getPoolEpoch(poolHash: string, epoch: number) {
  return optional(client.GET("/pool/{poolHash}/epoch/{epoch}", { params: { path: { poolHash, epoch } }, cache: "no-store" }));
}

export async function getPoolAlternatives() {
  try {
    return await handleRequest(client.GET("/poolAlternatives", { next: { revalidate: 3600 } }));
  } catch {
    return [];
  }
}

/** Open and recently closed governance actions, with the votes of a DRep and a pool on each if given. */
export async function getGovernance(drepId?: string | null, poolHash?: string | null) {
  return optional(
    client.GET("/governance", {
      params: { query: { drepId: drepId ?? undefined, poolHash: poolHash ?? undefined } },
      next: { revalidate: 300 },
    })
  );
}

/** Active DReps with name and the ADA delegated to them, the largest first. */
export async function getDreps() {
  try {
    return await handleRequest(client.GET("/dreps", { next: { revalidate: 3600 } }));
  } catch {
    return [];
  }
}
