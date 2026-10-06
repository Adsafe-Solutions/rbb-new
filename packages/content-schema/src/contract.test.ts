import { test } from "node:test";
import assert from "node:assert/strict";
import type { z } from "zod";
import {
  Appeal,
  DonationFormConfig,
  Event,
  Href,
  Link,
  Media,
  MediaId,
  Popup,
  Post,
  RichText,
  Section,
  SiteSettings,
  SeoOverrides,
  Slug,
  resolveDonationForm,
  sectionsFor,
  text,
} from "./index.ts";
import * as fx from "./test/fixtures.ts";

const ok = (schema: z.ZodType, value: unknown) => {
  const r = schema.safeParse(value);
  assert.ok(r.success, r.success ? "" : JSON.stringify(r.error.issues, null, 2));
};
const fails = (schema: z.ZodType, value: unknown, path?: (string | number)[]) => {
  const r = schema.safeParse(value);
  assert.ok(!r.success, "expected the contract to refuse this value");
  if (path) assert.ok(r.error.issues.some((i) => JSON.stringify(i.path) === JSON.stringify(path)), JSON.stringify(r.error.issues));
};

/* ---------------- Valid records ---------------- */

test("every fixture record is valid", () => {
  ok(Appeal, fx.appeal());
  ok(Post, fx.post());
  ok(Event, fx.event());
  ok(Popup, fx.popup());
  ok(Media, fx.media());
  ok(SiteSettings, fx.settings());
});

test("records survive JSON.stringify → JSON.parse unchanged and still validate", () => {
  for (const [schema, record] of [
    [Appeal, fx.appeal()],
    [Post, fx.post()],
    [Event, fx.event()],
    [Popup, fx.popup()],
    [SiteSettings, fx.settings()],
  ] as const) {
    const copy = JSON.parse(JSON.stringify(record));
    assert.deepEqual(copy, record);
    ok(schema, copy);
  }
});

/* ---------------- Required fields, enums, lifecycle ---------------- */

test("a missing required field is refused", () => {
  const { title: _title, ...noTitle } = fx.appeal();
  fails(Appeal, noTitle, ["title"]);
  const { orgId: _orgId, ...noOrg } = fx.appeal();
  fails(Appeal, noOrg, ["orgId"]);
});

test("an unknown enum value is refused", () => {
  fails(Appeal, { ...fx.appeal(), kind: "project" }, ["kind"]);
  fails(Post, { ...fx.post(), type: "page" }, ["type"]);
  fails(Popup, { ...fx.popup(), frequency: "always" }, ["frequency"]);
});

test("only draft, published and archived are publication states", () => {
  for (const status of ["draft", "published", "archived"]) ok(Appeal, { ...fx.appeal(), status });
  /* The web's legacy editorial statuses are translated by its importer,
     never stored as-is. */
  for (const status of ["approved", "verified", "pending-review", "placeholder", ""]) fails(Appeal, { ...fx.appeal(), status }, ["status"]);
});

test("fields the contract does not define are refused (no styling, no stray keys)", () => {
  fails(Appeal, { ...fx.appeal(), className: "bg-red-500" });
  fails(SiteSettings, { ...fx.settings(), resendApiKey: "re_123" });
  fails(SiteSettings, { ...fx.settings(), analytics: { mongodbUri: "mongodb+srv://x" } });
});

/* ---------------- Links and URLs ---------------- */

test("links accept site paths, #sections, https, mailto and tel", () => {
  for (const href of ["/", "/appeals", "/about#transparency", "/stories?category=field", "#donate", "https://www.instagram.com/rbb", "mailto:hello@rbb.org", "tel:+44 20 7946 0000"])
    ok(Href, href);
});

test("links refuse dangerous and unsupported schemes", () => {
  for (const href of ["javascript:alert(1)", "JavaScript:alert(1)", " javascript:alert(1)", "data:text/html,x", "vbscript:x", "http://example.org", "//evil.example", "ftp://x.org", "relative/path", "https://user:pw@x.org", ""])
    fails(Href, href);
  fails(Link, { label: "Go", href: "javascript:alert(1)" });
});

/* ---------------- Text, ids, media references ---------------- */

test("text is plain text: not empty, not HTML", () => {
  ok(text(100), "Opportunity for all.");
  fails(text(100), "   ");
  fails(text(100), "<script>alert(1)</script>");
  fails(text(100), "Hello <b>world</b>");
});

test("media references are ids, never URLs or paths", () => {
  ok(MediaId, "working-relief-packing");
  ok(MediaId, "665f1c2ab4e8a90012345678");
  for (const id of ["https://media.example.org/a.jpg", "../assets/a.jpg", "/src/assets/a.jpg", "a b", ""]) fails(MediaId, id);
  fails(Appeal, { ...fx.appeal(), imageId: "https://media.example.org/a.jpg" }, ["imageId"]);
  fails(Slug, "Emergency Appeal");
});

test("an image needs alt text unless it is decorative, and then it has none", () => {
  fails(Media, { ...fx.media(), alt: "" }, ["alt"]);
  ok(Media, { ...fx.media(), alt: "", decorative: true });
  fails(Media, { ...fx.media(), decorative: true }, ["alt"]);
});

/* ---------------- Sections ---------------- */

test("an unknown section type is refused", () => {
  fails(Section, { ...fx.statement(), type: "html", data: { html: "<div/>" } });
  fails(Section, { ...fx.statement(), type: "customReactComponent", data: { component: "DonationForm" } });
  fails(Section, { ...fx.statement(), type: "donationForm" });
});

test("a section's data must match its type", () => {
  fails(Section, { ...fx.statement(), data: { heading: "No body" } }, ["data", "body"]);
  fails(Section, { ...fx.statement(), type: "numberedCards", data: { heading: "Empty", items: [] } }, ["data", "items"]);
  fails(Section, { ...fx.statement(), data: { ...fx.statement().data, style: { color: "red" } } });
});

test("every section has a stable id and a schema version", () => {
  const { id: _id, ...noId } = fx.statement();
  fails(Section, noId, ["id"]);
  const { version: _v, ...noVersion } = fx.statement();
  fails(Section, noVersion, ["version"]);
  fails(Section, { ...fx.statement(), version: 2 }, ["version"]);
});

test("each page type accepts only its own blocks, with unique ids", () => {
  const cta = { id: "close", type: "cta", enabled: true, version: 1, data: { heading: "Join us", primary: { label: "Get involved", href: "/get-involved" } } };
  ok(sectionsFor("page"), [cta]);
  fails(sectionsFor("appeal"), [cta], [0, "type"]);
  fails(sectionsFor("appeal"), [fx.statement(), fx.statement()], [1, "id"]);
});

/* ---------------- Rich text ---------------- */

test("rich text is structured nodes only — no HTML node, no unsafe link", () => {
  ok(RichText, fx.post().body);
  fails(RichText, [{ type: "html", value: "<p>x</p>" }]);
  fails(RichText, [{ type: "heading", level: 1, children: [{ type: "text", text: "H1" }] }]);
  fails(RichText, [{ type: "paragraph", children: [{ type: "link", href: "javascript:alert(1)", children: [{ type: "text", text: "x" }] }] }]);
  fails(RichText, [{ type: "paragraph", children: [{ type: "text", text: "x", marks: ["underline"] }] }]);
  fails(RichText, []);
});

/* ---------------- SEO ---------------- */

test("SEO overrides are optional, bounded, and cannot set a canonical", () => {
  ok(Appeal, { ...fx.appeal(), seo: { title: "Emergency relief", noIndex: true, ogImageId: "working-aid-boxes" } });
  fails(SeoOverrides, { canonical: "https://elsewhere.example" });
  fails(SeoOverrides, { title: "x".repeat(71) }, ["title"]);
  fails(SeoOverrides, { ogImageId: "https://x.org/og.png" }, ["ogImageId"]);
});

/* ---------------- Domain rules ---------------- */

test("donation form config stays coherent, and overrides must merge into a valid form", () => {
  ok(DonationFormConfig, fx.donationForm());
  fails(DonationFormConfig, { ...fx.donationForm(), minimumAmount: 5000, maximumAmount: 100 }, ["minimumAmount"]);
  fails(DonationFormConfig, { ...fx.donationForm(), presetAmounts: [50] }, ["presetAmounts", 0]);
  fails(DonationFormConfig, { ...fx.donationForm(), frequencyOptions: { oneTime: false, monthly: false } });
  fails(DonationFormConfig, { ...fx.donationForm(), currency: "rupees" }, ["currency"]);
  assert.equal(resolveDonationForm(DonationFormConfig.parse(fx.donationForm()), { currency: "GBP" }).success, true);
  assert.equal(resolveDonationForm(DonationFormConfig.parse(fx.donationForm()), { minimumAmount: 2000 }).success, false);
});

test("dates, times and windows are real", () => {
  fails(Event, { ...fx.event(), date: "2026-13-40" }, ["date"]);
  fails(Event, { ...fx.event(), startTime: "18:30" }, ["startTime"]);
  fails(Event, { ...fx.event(), timezone: "somewhere" }, ["timezone"]);
  fails(Appeal, { ...fx.appeal(), startsOn: "2026-12-01", endsOn: "2026-11-01" }, ["endsOn"]);
  fails(Popup, { ...fx.popup(), startsAt: "2026-12-01T00:00:00Z", endsAt: "2026-11-01T00:00:00Z" }, ["endsAt"]);
});

test("a highlight must be part of its heading", () => {
  fails(Popup, { ...fx.popup(), highlight: "elsewhere" }, ["highlight"]);
});
