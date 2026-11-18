// Dev tool for visual checks: npx tsx-free → node scripts/screenshot.ts <ADMIN|CUSTOMER|ANON> <url> <out.png> [width] [full]
import { chromium } from "playwright";
import { sessionCookies } from "../tests/e2e/session.ts";

const [kind, url, out, w = "1440", full = "1"] = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: +w > 600 ? 900 : 844 } });
if (kind !== "ANON") await ctx.addCookies(await sessionCookies(kind as "ADMIN", url));
const page = await ctx.newPage();
const errs: string[] = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
await page.goto(url, { waitUntil: "networkidle" });
await page.screenshot({ path: out, fullPage: full === "1" });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
console.log(JSON.stringify({ out, finalUrl: page.url(), overflow, errs: errs.slice(0, 5) }));
await browser.close();
