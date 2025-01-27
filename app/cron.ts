import cron from "node-cron";

export const startCron = async () => {
  const baseUrl = process.env.BASE_URL || "https://cardano-tools.io";
  console.log("BASE_URL", baseUrl);
  const pagesToFetch = ["/browse"];
  cron.schedule("* * * * *", async () => {
    for (const page of pagesToFetch) {
      const result = await fetch(`${baseUrl}${page}`);
      console.log("Refreshed", page, result.status);
    }
  });
};
