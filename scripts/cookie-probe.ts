// Audit tool: forces a session refresh against a running server and prints the Set-Cookie attributes.
// node scripts/cookie-probe.ts http://localhost:3101
import { sessionCookies } from "../tests/e2e/session.ts";
const base = process.argv[2];
const cookies = await sessionCookies("CUSTOMER", base);
const byName = new Map(cookies.map((c) => [c.name, c.value]));
const baseName = [...byName.keys()][0].replace(/\.\d+$/, "");
const joined = [...byName.entries()].filter(([n]) => n.startsWith(baseName)).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v).join("");
const session = JSON.parse(Buffer.from(joined.replace(/^base64-/, ""), "base64url").toString());
session.expires_at = 1; // force the server to refresh the session
const forged = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
const res = await fetch(base + "/jewellery", { headers: { Cookie: `${baseName}=${forged}` }, redirect: "manual" });
const set = res.headers.getSetCookie();
console.log("status", res.status, "| Set-Cookie headers:", set.length);
for (const c of set) console.log("  " + c.replace(/=[^;]{12,}/, "=<value>"));
