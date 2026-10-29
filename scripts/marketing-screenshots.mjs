import { chromium } from "playwright";

const baseURL = process.env.E2E_BASE_URL || "http://localhost:3100";

const browser = await chromium.launch();

for (const [name, viewport] of [
  ["desktop", { width: 1440, height: 960 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const page = await browser.newPage({
    viewport,
    extraHTTPHeaders: { "x-forwarded-host": "plantel.ai" },
  });
  page.on("console", (message) =>
    console.log(`[${name}] console ${message.type()}: ${message.text()}`),
  );
  page.on("pageerror", (error) =>
    console.log(`[${name}] pageerror: ${error.message}`),
  );
  await page.goto(`${baseURL}/`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  console.log(
    `[${name}] body text:`,
    (await page.locator("body").innerText()).slice(0, 600),
  );
  console.log(
    `[${name}] body html:`,
    (await page.locator("body").innerHTML()).slice(0, 600),
  );
  await page.screenshot({
    path: `marketing-${name}.png`,
    fullPage: true,
  });
  await page.close();
}

await browser.close();
console.log("Screenshots written.");
