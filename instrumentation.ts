export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = await import("@/app/cron");
    cron.startCron();
  }
}
