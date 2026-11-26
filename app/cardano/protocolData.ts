"use server";

/**
 * The protocol parameters of the current epoch as the chain data API has them, null if it cannot tell. The site
 * then goes on with the values it knows, so this never fails.
 */
export async function getProtocolParams(): Promise<unknown> {
  try {
    const response = await fetch(`${process.env.CARDANO_DBSYNC_API_URL}/protocolParams`, { next: { revalidate: 600 }, signal: AbortSignal.timeout(10_000) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}
