// Dev/audit tool: node scripts/action-probe.ts <ANON|CUSTOMER|ADMIN> <actionName> '<json args>' [path]
import fs from "node:fs";
import { sessionCookies } from "../tests/e2e/session.ts";
const [who, name, args, path = "/jewellery"] = process.argv.slice(2);
const base = "http://localhost:3100";
let id = "";
const walk = (d: string) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = `${d}/${f.name}`; if (f.isDirectory()) walk(p); else if (f.name.endsWith(".js")) { const m = new RegExp(`"([0-9a-f]{40,})"[^)]*?"${name}"\\)`).exec(fs.readFileSync(p, "utf8")); if (m) id = m[1]; } } };
walk(".next/static/chunks");
const headers: Record<string, string> = { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", Origin: base };
if (who !== "ANON") headers.Cookie = (await sessionCookies(who as "ADMIN", base)).map((c) => `${c.name}=${c.value}`).join("; ");
const r = await fetch(base + path, { method: "POST", headers, body: args, redirect: "manual" });
console.log(who, name, "->", r.status, r.headers.get("content-type"), (await r.text()).slice(0, 200).replace(/\n/g, " "));
