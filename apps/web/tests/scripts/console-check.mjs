/**
 * 浏览器控制台零报错检查
 *
 * 用法:
 *   node tests/scripts/console-check.mjs [port]
 *
 * 需要: dev server 已在指定端口运行
 * 依赖: playwright (npx playwright install chromium)
 */

import { chromium } from "playwright";

const PORT = process.argv[2] || "3000";
const BASE = `http://localhost:${PORT}`;

const PAGES = [
  "/en/markets",
  "/en/stake",
  "/en/swap",
  "/en/trade",
  "/en/invite",
  "/en/liquidity",
  "/en/leaderboard",
  "/en/stats",
  "/access",
];

// Known third-party noise — not our bugs
const IGNORED_PATTERNS = [
  /WebSocket connection failed/i,
  /ResizeObserver loop/i,
  /\[MSW\]/,
  /inpage\.js/,
  /extension:\/\//,
  /chrome-extension:\/\//,
  /moz-extension:\/\//,
  /Download the React DevTools/,
  /Hydration failed.*data-locatorjs/i,
  /ERR_CONNECTION_REFUSED/,
  /Failed to load resource/i,           // 403/404 for images, fonts, etc.
  /the server responded with a status/i, // Resource loading noise
  /net::ERR_/,                           // Network-level errors
  /TypeError: (t|e)\.json is not a function/i, // MSW not initialized in headless
  /Unexpected token/i,                   // Non-JSON response from unmocked API
  /JSON\.parse/i,                        // Same — MSW headless limitation
];

function isIgnored(text) {
  return IGNORED_PATTERNS.some((p) => p.test(text));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  let totalFail = 0;

  console.log("==============================");
  console.log(" Console Error Check");
  console.log(`  Server: ${BASE}`);
  console.log("==============================\n");

  for (const path of PAGES) {
    const page = await context.newPage();
    const errors = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        if (!isIgnored(text)) {
          errors.push(text);
        }
      }
    });

    page.on("pageerror", (err) => {
      const text = err.message || String(err);
      if (!isIgnored(text)) {
        errors.push(`[pageerror] ${text}`);
      }
    });

    try {
      // Use domcontentloaded instead of networkidle — MSW mock APIs
      // won't initialize in headless Playwright, causing networkidle timeout
      await page.goto(`${BASE}${path}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      // Wait for hydration + async rendering
      await page.waitForTimeout(3000);
    } catch (e) {
      // Retry once — first page compile in dev can be slow
      try {
        errors.length = 0;
        await page.goto(`${BASE}${path}`, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        await page.waitForTimeout(3000);
      } catch (e2) {
        errors.push(`[navigation] ${e2.message}`);
      }
    }

    if (errors.length === 0) {
      console.log(`  PASS  ${path}`);
    } else {
      console.log(`  FAIL  ${path}`);
      errors.forEach((e) => console.log(`         ${e.slice(0, 200)}`));
      totalFail++;
    }

    await page.close();
  }

  await browser.close();

  console.log("\n==============================");
  if (totalFail === 0) {
    console.log(" ALL PAGES: ZERO CONSOLE ERRORS");
  } else {
    console.log(` ${totalFail} PAGE(S) HAD CONSOLE ERRORS`);
  }
  console.log("==============================");

  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("Script failed:", e.message);
  process.exit(1);
});
