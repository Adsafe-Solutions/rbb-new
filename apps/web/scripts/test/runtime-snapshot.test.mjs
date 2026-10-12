import { test } from "node:test";
import assert from "node:assert/strict";
import { runtimeSnapshotConfig, runtimeSnapshotEnv, mediaOriginsOf, allowedSnapshotUrl } from "../runtime-snapshot.mjs";
import { appendRuntimeHook, exportedRoots } from "../vite-published-snapshot.mjs";
import { BY_ID, appendOverrides, overridesFrom } from "../snapshot-adapter.mjs";
import { contentSecurityPolicy, securityHeaders } from "../security-policy.mjs";
import { applyOverrides } from "../../src/lib/snapshotOverrides.js";
import { loadRuntimeSnapshot, mountMode } from "../../src/lib/runtimeSnapshot.js";

/* The runtime snapshot (docs/PUBLISHING.md "Runtime snapshot"): what the
   build compiles in (scripts/runtime-snapshot.mjs, the plugin's hook and
   the page policy), and what the browser decides from the API's answer
   (src/lib/runtimeSnapshot.js) — with the browser faked, so each outcome
   is exercised exactly. */

const snapshot = (overrides = {}) => ({
  version: 4,
  schemaVersion: 1,
  generatedAt: "2026-10-07T10:00:00.000Z",
  organization: { id: "rbb" },
  settings: {
    id: "site-settings", orgId: "rbb", schemaVersion: 1, status: "published",
    general: { shortName: "RBB", name: "Rising Beyond Borders", summary: "A summary." },
    contact: { methods: [] },
    social: [],
    seo: { description: "A description." },
    branding: {}, analytics: {}, engagement: {}, features: {},
  },
  media: {},
  content: {},
  ...overrides,
});
const media = (origin) => ({ img: { id: "img", url: `${origin}/img.jpg`, alt: "An image", type: "image/jpeg", size: 1 } });

/* ---------------- The build side ---------------- */

test("configuration: on only for a build that applied a snapshot and knows the URL; off by RBB_SNAPSHOT_RUNTIME=off; never silently misconfigured", () => {
  const env = { RBB_SNAPSHOT_URL: "https://api.example.org/api/v1/public/snapshot" };
  assert.equal(runtimeSnapshotConfig({ env, snapshot: null }), null, "no snapshot: static");
  assert.equal(runtimeSnapshotConfig({ env: {}, snapshot: snapshot() }), null, "no URL: static");
  assert.equal(runtimeSnapshotConfig({ env: { ...env, RBB_SNAPSHOT_RUNTIME: "off" }, snapshot: snapshot() }), null);
  assert.equal(runtimeSnapshotConfig({ env: { ...env, RBB_SNAPSHOT: "off" }, snapshot: snapshot() }), null);
  const config = runtimeSnapshotConfig({ env, snapshot: snapshot({ version: 7, media: media("https://media.example.org") }) });
  assert.deepEqual(config, { url: env.RBB_SNAPSHOT_URL, origin: "https://api.example.org", version: 7, orgId: "rbb", timeoutMs: 3000, mediaOrigins: ["https://media.example.org"] });
  assert.deepEqual(runtimeSnapshotConfig({ env: { ...env, RBB_SNAPSHOT_RUNTIME_TIMEOUT_MS: "1500", RBB_MEDIA_ORIGINS: "https://cdn.example.org, https://media.example.org" }, snapshot: snapshot({ media: media("https://media.example.org") }) }).mediaOrigins, ["https://cdn.example.org", "https://media.example.org"]);
  assert.equal(runtimeSnapshotConfig({ env: { ...env, RBB_SNAPSHOT_RUNTIME_TIMEOUT_MS: "1500" }, snapshot: snapshot() }).timeoutMs, 1500);
  assert.throws(() => runtimeSnapshotConfig({ env: { ...env, RBB_SNAPSHOT_RUNTIME_TIMEOUT_MS: "100" }, snapshot: snapshot() }), /between 500 and 30000/);
  assert.throws(() => runtimeSnapshotConfig({ env: { ...env, RBB_MEDIA_ORIGINS: "http://media.example.org" }, snapshot: snapshot() }), /not a plain https origin/);
  assert.throws(() => runtimeSnapshotConfig({ env: { ...env, RBB_MEDIA_ORIGINS: "https://media.example.org/path" }, snapshot: snapshot() }), /not a plain https origin/);
  assert.throws(() => runtimeSnapshotConfig({ env: { RBB_SNAPSHOT_URL: "http://api.example.org/snapshot" }, snapshot: snapshot() }), /https/);
  assert.ok(allowedSnapshotUrl("http://localhost:4000/api/v1/public/snapshot"), "a local API, for a local build");
  assert.ok(!allowedSnapshotUrl("https://user:pw@api.example.org/x"));
  assert.deepEqual(mediaOriginsOf(snapshot({ media: { ...media("https://b.example.org"), two: { id: "two", url: "https://a.example.org/x.png", alt: "", type: "image/png", size: 1 } } })), ["https://a.example.org", "https://b.example.org"]);
  const env$ = JSON.parse(runtimeSnapshotEnv(config));
  assert.deepEqual(env$, { url: env.RBB_SNAPSHOT_URL, version: 7, orgId: "rbb", timeoutMs: 3000 }, "the bundle gets public values only");
  assert.equal(runtimeSnapshotEnv(null), "");
});

test("the hook: every capitalised export of a target module, handed to applyRuntimeOverrides by name at the module's end", () => {
  const code = "import x from './x.js';\nexport const BRAND = { name: 'x' };\nconst helper = 1;\nexport const SITE_COPY = {};\nexport const notThis = {};\nexport default BRAND;";
  assert.deepEqual(exportedRoots(code), ["BRAND", "SITE_COPY"]);
  const out = appendRuntimeHook(code, "src/content/brand.js");
  assert.ok(out.startsWith(code));
  assert.match(out, /import \{ applyRuntimeOverrides as __rbbApplyRuntimeOverrides \} from "\/src\/lib\/runtimeOverrides\.js";/);
  assert.match(out, /__rbbApplyRuntimeOverrides\("src\/content\/brand\.js", \{ BRAND, SITE_COPY \}\);/);
  assert.throws(() => appendRuntimeHook("const nothing = 1;", "src/content/x.js"), /declares no "export const NAME"/);
});

test("the page policy: the API's origin in connect-src only when a build fetches at runtime; nothing else changes", () => {
  const inline = { scripts: [], styles: [] };
  const plain = contentSecurityPolicy(inline);
  assert.match(plain, /connect-src 'self';/);
  const withApi = contentSecurityPolicy(inline, { connect: ["https://api.example.org"], images: ["https://media.example.org"] });
  assert.match(withApi, /connect-src 'self' https:\/\/api\.example\.org;/);
  assert.match(withApi, /img-src 'self' https:\/\/media\.example\.org;/);
  assert.equal(withApi.replace(" https://api.example.org", "").replace(" https://media.example.org", ""), plain);
  assert.match(securityHeaders(inline, { connect: ["https://api.example.org"] })["/*"]["Content-Security-Policy"], /connect-src 'self' https:\/\/api\.example\.org;/);
});

/* ---------------- Applying overrides: the browser does what the build does ---------------- */

/* The build's appended code, run against the same fake module. */
function viaBuild(exports, overrides, file) {
  const names = Object.keys(exports);
  const code = names.map((n) => `export const ${n} = module.${n};`).join("\n");
  const appended = appendOverrides(code, file, overrides).replace(/export const /g, "const ");
  new Function("module", appended)(exports);
  return exports;
}
const fresh = () => ({
  BRAND: { name: "RBB", fullName: "Rising Beyond Borders" },
  LIST: [{ id: "a", v: 1 }, { id: "b", v: 2 }],
  PAGES: { hub: { heading: "Old", nested: { kicker: "k" }, items: [1, 2] }, paths: [{ id: "p1", text: "one" }, { id: "p2", text: "two" }] },
});
const CASES = {
  object: { BRAND: { name: "New", summary: "S" } },
  collection: { LIST: [{ id: "z", v: 9 }] },
  nestedObject: { "PAGES.hub": { heading: "New heading" }, "PAGES.hub.nested": { kicker: "K2" } },
  nestedCollection: { "PAGES.hub.items": [3] },
  byId: { LIST: { [BY_ID]: { b: { v: 20, extra: true } } } },
  nestedById: { "PAGES.paths": { [BY_ID]: { p2: { text: "TWO" } } } },
};

test("applyOverrides: each form — object, collection, nested, by id — leaves the module exactly as the build's appended assignments would", () => {
  for (const [name, overrides] of Object.entries(CASES)) {
    const built = viaBuild(fresh(), overrides, "src/content/x.js");
    const applied = fresh();
    applyOverrides(applied, overrides, "src/content/x.js");
    assert.deepEqual(applied, built, name);
    assert.notDeepEqual(applied, fresh(), `${name}: something changed`);
  }
  /* In place: the same objects the module exported, not replacements. */
  const m = fresh();
  const { BRAND, LIST, PAGES } = m;
  applyOverrides(m, { ...CASES.object, ...CASES.collection, ...CASES.nestedObject }, "x.js");
  assert.ok(m.BRAND === BRAND && m.LIST === LIST && m.PAGES === PAGES && m.PAGES.hub.nested.kicker === "K2");
  /* Never sharing an object with the snapshot. */
  const value = { name: "Shared" };
  applyOverrides(m, { BRAND: value }, "x.js");
  value.name = "Changed later";
  assert.equal(m.BRAND.name, "Shared");
});

test("applyOverrides: the build's refusals, word for word — a missing export, a target that is not that kind of object, a record id that is not there", () => {
  assert.throws(() => applyOverrides(fresh(), { GONE: {} }, "src/content/x.js"), /src\/content\/x\.js no longer declares "export const GONE"/);
  assert.throws(() => applyOverrides(fresh(), { "PAGES.missing": { a: 1 } }, "src/content/x.js"), /PAGES\.missing is not the object the snapshot sets/);
  assert.throws(() => applyOverrides(fresh(), { "PAGES.hub": [1] }, "src/content/x.js"), /is not the object the snapshot sets/);
  assert.throws(() => applyOverrides(fresh(), { "PAGES.hub.items": { a: 1 } }, "src/content/x.js"), /is not the object the snapshot sets/);
  assert.throws(() => applyOverrides(fresh(), { LIST: { [BY_ID]: { nope: {} } } }, "src/content/x.js"), /LIST has no record "nope"/);
  assert.throws(() => applyOverrides(fresh(), { "PAGES.paths": { [BY_ID]: { nope: {} } } }, "src/content/x.js"), /has no record "nope"/);
  assert.throws(() => applyOverrides(fresh(), { "brand.x": {} }, "src/content/x.js"), /not a target the snapshot can set/);
  /* Parity: the build's appended code refuses the same shapes, when it runs. */
  assert.throws(() => viaBuild(fresh(), { "PAGES.hub": [1] }, "src/content/x.js"), /PAGES\.hub is not the object the snapshot sets/);
  assert.throws(() => viaBuild(fresh(), { "PAGES.paths": { [BY_ID]: { nope: {} } } }, "src/content/x.js"), /has no record "nope"/);
  assert.throws(() => appendOverrides("export const PAGES = {};", "src/content/x.js", { GONE: {} }), /no longer declares "export const GONE"/);
});

/* ---------------- The browser's decision ---------------- */

const CONFIG = { url: "https://api.example.org/api/v1/public/snapshot", version: 4, orgId: "rbb", timeoutMs: 1000 };
const json = (data, { status = 200, headers = {} } = {}) => ({ ok: status >= 200 && status < 300, status, headers: new Map(Object.entries(headers)), json: async () => data });
const broken = (status) => ({ ok: false, status, json: async () => ({}) });
/* One fetch per outcome: `network` for the plain request, `cached` for the force-cache retry. */
const fakeFetch = ({ network, cached }) => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, cache: init.cache ?? "default", headers: init.headers, signal: init.signal });
    const answer = init.cache === "force-cache" ? cached : network;
    if (typeof answer === "function") return answer();
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { fetch, calls };
};
const validateOk = async () => [];
const load = (fetchSpec, extra = {}) => {
  const { fetch, calls } = fakeFetch(fetchSpec);
  const validations = [];
  const validate = extra.validate ?? (async (s) => (validations.push(s.version), []));
  return loadRuntimeSnapshot({ config: CONFIG, fetch, validate, now: () => 0, ...extra, validate }).then((r) => ({ ...r, calls, validations }));
};

test("a fresh snapshot: newer than the build, checked in full and applied; one simple GET, nothing that would need a preflight", async () => {
  const newer = snapshot({ version: 5, settings: { ...snapshot().settings, general: { shortName: "RBB", name: "Rising Beyond Borders (new)", summary: "New." } } });
  const r = await load({ network: json({ data: newer }) });
  assert.equal(r.status, "newer");
  assert.equal(r.version, 5);
  assert.equal(r.source, "network");
  assert.deepEqual(r.validations, [5], "the contract ran on it");
  assert.equal(r.overrides["src/content/brand.js"].BRAND.fullName, "Rising Beyond Borders (new)");
  assert.equal(r.calls.length, 1);
  assert.deepEqual(r.calls[0].headers, { Accept: "application/json" }, "Accept only — a simple request");
  assert.equal(r.calls[0].cache, "default", "the browser's own cache and ETag revalidation");
  assert.ok(r.calls[0].signal instanceof AbortSignal, "bounded by the timeout");
});

test("unchanged: the same version as the build — or a 304 — is not checked again and changes nothing", async () => {
  const same = await load({ network: json({ data: snapshot({ version: 4 }) }) });
  assert.equal(same.status, "same");
  assert.deepEqual(same.validations, [], "a version never changes once published");
  assert.equal(same.snapshot, null);
  const notModified = await load({ network: json(null, { status: 304 }) });
  assert.equal(notModified.status, "same");
  assert.equal(notModified.calls.length, 1);
});

test("older than the build: ignored — the build is newer than what the API serves", async () => {
  const r = await load({ network: json({ data: snapshot({ version: 3 }) }) });
  assert.equal(r.status, "older");
  assert.deepEqual(r.validations, []);
  assert.equal(r.snapshot, null);
});

test("malformed: a newer snapshot that fails any check is rejected whole — the baked snapshot stays", async () => {
  const another = await load({ network: json({ data: snapshot({ version: 9, organization: { id: "other" } }) }) });
  assert.equal(another.status, "rejected");
  assert.match(another.problems.join(), /another organization/);
  assert.deepEqual(another.validations, [], "not even the contract: the structure failed first");
  const notJson = await load({ network: { ok: true, status: 200, json: async () => { throw new SyntaxError("bad"); } } });
  assert.equal(notJson.status, "rejected");
  assert.match(notJson.problems.join(), /not a snapshot object/);
  const contract = await load({ network: json({ data: snapshot({ version: 9 }) }) }, { validate: async () => ["settings.general.name: Required"] });
  assert.equal(contract.status, "rejected");
  assert.deepEqual(contract.problems, ["settings.general.name: Required"]);
  assert.equal(contract.snapshot, null);
  const undrawable = await load({ network: json({ data: snapshot({ version: 9 }) }) }, { apply: () => { throw new Error("snapshot: the homepage has a \"mystery\" block, which this site cannot draw"); } });
  assert.equal(undrawable.status, "rejected");
  assert.match(undrawable.problems[0], /cannot draw/);
});

test("API errors: the browser's cached copy is tried next and checked like a fresh one; with none, unavailable — and the reason is kept", async () => {
  const cachedNewer = await load({ network: broken(503), cached: json({ data: snapshot({ version: 6 }) }) });
  assert.equal(cachedNewer.status, "newer");
  assert.equal(cachedNewer.source, "cache");
  assert.equal(cachedNewer.reason, "the API answered 503");
  assert.deepEqual(cachedNewer.validations, [6]);
  assert.equal(cachedNewer.calls[1].cache, "force-cache");
  const cachedSame = await load({ network: new TypeError("Failed to fetch"), cached: json({ data: snapshot({ version: 4 }) }) });
  assert.equal(cachedSame.status, "same");
  assert.equal(cachedSame.source, "cache");
  const nothing = await load({ network: new TypeError("Failed to fetch"), cached: new TypeError("Failed to fetch") });
  assert.equal(nothing.status, "unavailable");
  assert.equal(nothing.source, "none");
  assert.equal(nothing.reason, "Failed to fetch");
  assert.equal(nothing.calls.length, 2);
  const unpublished = await load({ network: broken(404), cached: broken(404) });
  assert.equal(unpublished.status, "unavailable");
  assert.match(unpublished.reason, /nothing is published \(404\)/);
});

test("a slow API: the request is abandoned at the timeout, the cache tried, and the page goes on with what it has", async () => {
  const hang = () => new Promise((_resolve, reject) => setTimeout(() => reject(Object.assign(new Error("timed out"), { name: "TimeoutError" })), 5));
  const r = await load({ network: hang, cached: new TypeError("no cache") }, { config: { ...CONFIG, timeoutMs: 500 } });
  assert.equal(r.status, "unavailable");
  assert.equal(r.reason, "no answer within 500ms");
});

test("mounting: hydrate the pre-rendered page unless a newer snapshot was applied or the page was not pre-rendered for this address", () => {
  assert.equal(mountMode({ prerendered: true, status: "same" }), "hydrate");
  assert.equal(mountMode({ prerendered: true, status: null }), "hydrate", "a static build");
  assert.equal(mountMode({ prerendered: true, status: "unavailable" }), "hydrate", "the baked content IS the HTML");
  assert.equal(mountMode({ prerendered: true, status: "newer" }), "render", "never hydrated against content the HTML does not hold");
  assert.equal(mountMode({ prerendered: false, status: "same" }), "render", "404.html, the dev shell");
});
