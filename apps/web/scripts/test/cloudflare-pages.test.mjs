import { test } from "node:test";
import assert from "node:assert/strict";
import { cloudflareHeaders, cloudflareRedirects } from "../cloudflare-pages.mjs";
import { securityHeaders } from "../security-policy.mjs";

/* Cloudflare Pages' _redirects and _headers, from the build's own
   redirect list and security headers (docs/HOST_CONFIGURATION.md). */

const REDIRECTS = [
  { from: "/about-us", to: "/about", status: 301 },
  { from: "/reports", to: "/about#transparency", status: 301 },
  { from: "/blogs/market-day", to: "/stories/market-day", status: 301 },
];
const parseHeaders = (text) => {
  const rules = new Map();
  let current;
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    if (!line.startsWith("  ")) rules.set(line, (current = []));
    else current.push(line.trim());
  }
  return rules;
};

test("_redirects: every redirect, as a 301, with and without its trailing slash; fragments kept", () => {
  const lines = cloudflareRedirects(REDIRECTS).split("\n").filter((l) => l && !l.startsWith("#"));
  assert.deepEqual(lines, [
    "/about-us /about 301",
    "/about-us/ /about 301",
    "/reports /about#transparency 301",
    "/reports/ /about#transparency 301",
    "/blogs/market-day /stories/market-day 301",
    "/blogs/market-day/ /stories/market-day 301",
  ]);
});

test("_redirects: anything Cloudflare cannot express fails loudly — never silently dropped", () => {
  assert.throws(() => cloudflareRedirects([{ from: "/a b", to: "/b", status: 301 }]), /not a plain site path/);
  assert.throws(() => cloudflareRedirects([{ from: "/a", to: "/b c", status: 301 }]), /one token/);
  assert.throws(() => cloudflareRedirects([{ from: "/a", to: "/b", status: 410 }]), /status 410/);
});

test("_headers: the real security headers on every page; /assets/* replaces Cache-Control; previews noindex; no HSTS without a verified origin", () => {
  const headers = securityHeaders({ scripts: [], styles: [] });
  const rules = parseHeaders(cloudflareHeaders(headers));
  const all = rules.get("/*");
  for (const [name, value] of Object.entries(headers["/*"])) assert.ok(all.includes(`${name}: ${value}`), name);
  assert.deepEqual(rules.get("/assets/*"), ["! Cache-Control", "Cache-Control: public, max-age=31536000, immutable"], "detached, never joined with no-cache");
  assert.deepEqual(rules.get("https://:project.pages.dev/*"), ["X-Robots-Tag: noindex, nofollow"]);
  assert.deepEqual(rules.get("https://:version.:project.pages.dev/*"), ["X-Robots-Tag: noindex, nofollow"]);
  assert.ok(![...rules.values()].flat().some((l) => l.startsWith("Strict-Transport-Security")), "no HSTS on any host without a verified origin");
  assert.ok(all.some((l) => l.startsWith("X-Frame-Options: DENY")));
});

test("_headers: HSTS only on the verified production origin", () => {
  const headers = securityHeaders({ scripts: [], styles: [] });
  const rules = parseHeaders(cloudflareHeaders(headers, { productionOrigin: "https://prod.risingbeyondborders.org" }));
  assert.deepEqual(rules.get("https://prod.risingbeyondborders.org/*"), ["Strict-Transport-Security: max-age=31536000"]);
  assert.ok(!rules.get("/*").some((l) => l.startsWith("Strict-Transport-Security")), "never on every host");
});

test("_headers: a line over Cloudflare's limit fails loudly", () => {
  assert.throws(() => cloudflareHeaders({ "/*": { "Content-Security-Policy": "x".repeat(2100) } }), /limit 2000/);
});
