const POLL_MS = 5000;
const MAX_POLLS = 240;

async function isConfirmed(txHash: string): Promise<boolean> {
  const response = await fetch(`/api/tx/${txHash}/confirmed`, { cache: "no-store" });
  return response.ok && (await response.json()).confirmed === true;
}

/**
 * Follows a submitted transaction and calls back once it is on-chain. Gives up after twenty minutes.
 * Returns a function that stops following.
 */
export function watchConfirmation(txHash: string, onConfirmed: () => void): () => void {
  let polls = 0;
  const interval = setInterval(async () => {
    polls++;
    // the chain index may be behind or unavailable, the transaction is submitted either way
    const confirmed = await isConfirmed(txHash).catch(() => false);
    if (confirmed || polls >= MAX_POLLS) clearInterval(interval);
    if (confirmed) onConfirmed();
  }, POLL_MS);
  return () => clearInterval(interval);
}
