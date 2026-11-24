/** Runs once when the server starts. The Telegram bot lives in this process, so there is exactly one. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.TELEGRAM_BOT_TOKEN) {
    const { startAlerts } = await import("./app/alerts/worker");
    await startAlerts();
  }
}
