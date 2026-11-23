import { isTransactionConfirmed } from "@cardano/dbsync";

/**
 * Whether a transaction is on-chain. A page follows its transaction through this address instead of a
 * server action, because a server action of a page that was loaded before a release no longer exists after it.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ txHash: string }> }) {
  const { txHash } = await params;
  if (!/^[0-9a-f]{64}$/i.test(txHash)) {
    return Response.json({ error: "Not a transaction hash" }, { status: 400 });
  }
  try {
    return Response.json({ confirmed: Boolean(await isTransactionConfirmed(txHash)) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Chain data is not available" }, { status: 503 });
  }
}
