/** The Pushgateway of the pool, where the leaderlog job leaves its numbers. Only reachable inside the server. */
const PUSHGATEWAY_URL = (process.env.PUSHGATEWAY_URL || "http://prometheus-pushgateway:9091").replace(/\/$/, "");

/** All metrics of the Pushgateway as text, empty when it cannot be reached. */
export async function pushgatewayMetrics(): Promise<string> {
  try {
    const response = await fetch(`${PUSHGATEWAY_URL}/metrics`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
    return response.ok ? await response.text() : "";
  } catch {
    return "";
  }
}
