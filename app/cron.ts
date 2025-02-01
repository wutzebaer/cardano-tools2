import cron from "node-cron";
import puppeteer from "puppeteer";

export const startCron = async () => {
  const baseUrl = `http://localhost:${process.env.PORT}`;
  console.log("BASE_URL", baseUrl);
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 30000 });
  const paths = ["/browse"];
  cron.schedule("* * * * *", async () => {
    for (const path of paths) {
      await page.goto(`${baseUrl}${path}`, {
        waitUntil: "networkidle0",
      });
      console.log(`Refreshed ${path}`);
    }
  });
};
