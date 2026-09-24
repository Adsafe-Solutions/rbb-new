/* Pre-renders every public route to static HTML — Document 15.

   Runs after the two Vite builds (see "build" in package.json):
     dist/       the client build: hashed JS/CSS/images and index.html,
                 which serves as the template for every page
     dist-ssr/   the same app built for Node (src/entry-server.jsx)

   Writes into dist/:
     <route>/index.html   one per public route — its content in #root and
                          its own title, description, canonical, robots,
                          social tags and structured data in <head>
     404.html             the not-found page, noindex
     <alias>/index.html   a tiny forwarding page per redirect (meta
                          refresh, no JavaScript) — a fallback until the
                          host serves real 301s from build-meta/
     robots.txt, sitemap.xml (the latter only with a verified origin)
   And, OUTSIDE the published folder, for whoever configures the host:
     build-meta/redirects.json   every permanent redirect, final targets
     build-meta/routes.json      every pre-rendered route
     build-meta/content-report.json  approved records published, records
                          held back by the publishing filter, warnings
                          (counts and locations only — no content)
     build-meta/security-headers.json  the Content Security Policy and every
                          other response header, by path, for the host
                          (Document 20). The CSP is also written into each
                          page as <meta http-equiv>; RBB_CSP=report-only
                          omits the <meta> and marks the header Report-Only
     build-meta/observability.json  which measurement streams this build
                          would run (all off until RBB approves one), and
                          every third-party origin the pages load from

   ANY failure exits non-zero, so a deployment that runs `npm run build`
   stops instead of publishing an incomplete site. */
import { mkdir, readFile, rm, writeFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  APPROVED_ORIGINS,
  CHECKOUT_ROUTE,
  RAZORPAY,
  approvedOriginList,
  collectInline,
  contentSecurityPolicy,
  securityHeaders,
} from "./security-policy.mjs";
import { productionGate, contentReadiness } from "./production-gate.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const ssrDir = join(root, "dist-ssr");
const metaDir = join(root, "build-meta");

/* A fingerprint of what the site is built FROM: every file under
   src/content and src/assets, hashed in path order. Changes whenever any
   content or asset changes. */
async function buildRevision() {
  const { createHash } = await import("node:crypto");
  const { execFileSync } = await import("node:child_process");
  const list = async (dir) => {
    const out = [];
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) out.push(...(await list(p)));
      else out.push(p);
    }
    return out;
  };
  const files = [
    ...(await list(join(root, "src/content"))),
    ...(await list(join(root, "src/assets"))),
  ].sort();
  const hash = createHash("sha256");
  for (const f of files) hash.update(f.slice(root.length)).update(await readFile(f));
  let commit = null;
  try {
    commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    commit = null;
  }
  let dirty = null;
  try {
    dirty =
      execFileSync("git", ["status", "--porcelain", "--", "src"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim().length > 0;
  } catch {
    dirty = null;
  }
  return {
    contentRevision: hash.digest("hex").slice(0, 16),
    files: files.length,
    gitCommit: commit,
    uncommittedSourceChanges: dirty,
  };
}

const fail = (message) => {
  console.error(`\n✗ prerender: ${message}\n`);
  process.exit(1);
};

const escapeAttr = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/* The template's own <title> and description are the defaults for an
   un-rendered shell; every rendered page replaces both with its own. */
function fill(template, { head, html, route }) {
  const out = template
    .replace(/<title>[\s\S]*?<\/title>/, "<!--seo-->")
    .replace(/<!--[^>]*?BRAND\.summary[\s\S]*?-->\s*/, "")
    .replace(/<meta\s+name="description"[\s\S]*?\/>/, "")
    .replace("<!--seo-->", head)
    .replace(
      '<div id="root"></div>',
      `<div id="root" data-route="${escapeAttr(route)}">${html}</div>`
    );
  if (!out.includes(`data-route="${escapeAttr(route)}"`))
    fail(`could not inject ${route} into the template`);
  return out;
}

const fileFor = (route) =>
  route === "/" ? join(dist, "index.html") : join(dist, route, "index.html");

async function write(file, contents) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, contents);
}

/* A forwarding page for one redirect: meta refresh (no JavaScript),
   noindex, and the target as canonical when the origin is known. */
function redirectPage(to, canonical) {
  const target = escapeAttr(to);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="robots" content="noindex" />
    <meta http-equiv="refresh" content="0; url=${target}" />${canonical ? `\n    <link rel="canonical" href="${escapeAttr(canonical)}" />` : ""}
    <title>Redirecting…</title>
  </head>
  <body>
    <p><a href="${target}">This page has moved.</a></p>
  </body>
</html>
`;
}

async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await htmlFiles(p)));
    else if (/\.(html|xml|txt|js)$/.test(entry.name)) out.push(p);
  }
  return out;
}

try {
  const template = await readFile(join(dist, "index.html"), "utf8");
  const ssr = await import(pathToFileURL(join(ssrDir, "entry-server.js")).href);

  const routes = ssr.prerenderPaths();
  const redirects = ssr.redirects();

  /* Document 18: validate the content first. Any error stops the build —
     a malformed approved record never becomes a public page. */
  const check = ssr.validate();
  if (check.errors.length) {
    fail(
      `content validation failed (${check.errors.length}):\n  - ${check.errors.join("\n  - ")}\n\n` +
        "Fix the records above in src/content/, or set them back to pending-review."
    );
  }
  for (const w of check.warnings) console.warn(`  content warning: ${w}`);

  /* A redirect alias must never also be a page. */
  const clash = redirects.find((r) => routes.includes(r.from));
  if (clash) fail(`${clash.from} is both a page and a redirect`);

  /* Pages are assembled first and written last: the Content Security
     Policy (Document 20) is built from the inline code they contain. */
  const pages = [];
  for (const route of routes) {
    const page = ssr.render(route);
    /* A route that is meant to be a page but rendered the 404 is a broken
       route — stop, rather than publish "Page not found" at a real URL. */
    if (page.meta.route === ssr.notFoundMeta().route)
      fail(`${route} rendered the not-found page`);
    if (!/<h1[\s>]/.test(page.html)) fail(`${route} rendered without an <h1>`);
    pages.push({ route, file: fileFor(route), html: fill(template, { ...page, route }) });
  }

  /* 404.html — rendered at an address no route matches. */
  const missing = ssr.render("/__not-found__");
  pages.push({
    file: join(dist, "404.html"),
    html: fill(template, { ...missing, route: "/404" }),
  });

  /* Document 20: the CSP from exactly what the pages contain — the inline
     script hashes and style-attribute hashes — then into every page as a
     <meta>, right after <meta charset> so it governs everything after it. */
  const reportOnly = process.env.RBB_CSP === "report-only";
  const inline = collectInline(pages.map((p) => p.html));
  /* Document 22: Razorpay Checkout's origins go into ONE page's policy —
     the donation page — and only when this build turns checkout on. */
  const checkout = ssr.donationCheckout();
  if (checkout.enabled && !routes.includes(CHECKOUT_ROUTE))
    fail(`donation checkout is on, but ${CHECKOUT_ROUTE} is not a published page`);
  const metaCsp = contentSecurityPolicy(inline, { forMeta: true });
  const checkoutCsp = contentSecurityPolicy(inline, { forMeta: true, checkout: true });
  for (const { route, file, html } of pages) {
    const policy = checkout.enabled && route === CHECKOUT_ROUTE ? checkoutCsp : metaCsp;
    const out = reportOnly
      ? html
      : html.replace(
          /(<meta charset="UTF-8" \/>)/,
          `$1\n    <meta http-equiv="Content-Security-Policy" content="${escapeAttr(policy)}" />`
        );
    if (!reportOnly && !out.includes('http-equiv="Content-Security-Policy"'))
      fail(`could not add the Content Security Policy to ${file.slice(root.length + 1)}`);
    await write(file, out);
  }

  for (const { from, to } of redirects) {
    await write(fileFor(from), redirectPage(to, ssr.absoluteUrl(to.split("#")[0])));
  }

  await writeFile(join(dist, "robots.txt"), ssr.robotsTxt());
  const sitemap = ssr.sitemapXml();
  if (sitemap) await writeFile(join(dist, "sitemap.xml"), sitemap);

  await mkdir(metaDir, { recursive: true });
  await writeFile(
    join(metaDir, "redirects.json"),
    JSON.stringify(
      redirects.map((r) => ({ ...r, status: 301 })),
      null,
      2
    ) + "\n"
  );
  await writeFile(join(metaDir, "routes.json"), JSON.stringify(routes, null, 2) + "\n");

  /* Every image an approved record publishes must exist in the build. */
  for (const src of ssr.publicImages()) {
    const file = join(dist, src.replace(/^\//, "").split("?")[0]);
    if (
      !(await readFile(file).then(
        () => true,
        () => false
      ))
    )
      fail(`an approved record's image "${src}" is not in the build output`);
  }

  /* Document 18: what was published, and what the publishing filter
     (scripts/content-publishing.mjs) held back — counts only. */
  const excluded = JSON.parse(
    await readFile(join(metaDir, "content-excluded.json"), "utf8").catch(() => "{}")
  );
  const heldBack = Object.values(excluded).reduce((n, c) => n + c.removed, 0);
  await writeFile(
    join(metaDir, "content-report.json"),
    JSON.stringify(
      {
        approvedPublished: check.counts,
        heldBackByFilter: excluded,
        warnings: check.warnings,
      },
      null,
      2
    ) + "\n"
  );

  /* Document 17: make the build's measurement state verifiable without
     reading source. Every origin a published page loads a script, style,
     font or image from, other than the site itself, is listed. */
  const origins = new Set();
  for (const file of (await htmlFiles(dist)).filter((f) => f.endsWith(".html"))) {
    const text = await readFile(file, "utf8");
    for (const m of text.matchAll(
      /<(?:script|link|img|iframe|source)\b[^>]*?\b(?:src|href|srcset)="(https?:\/\/[^"/]+)/g
    )) {
      /* The site's own verified origin (canonical, og:url, the sitemap's
         absolute URLs) is first-party, not a third party (Document 24:
         found when a production origin was first set). */
      if (m[1] !== ssr.siteOrigin()) origins.add(m[1]);
    }
  }
  const obs = { ...ssr.observability(), thirdPartyOrigins: [...origins].sort() };

  /* No page may load from an origin the CSP does not approve — a new
     provider needs its own approved phase (scripts/security-policy.mjs). */
  /* Document 21: a form endpoint must be same-origin, or an approved
     connect origin — the CSP's connect-src is built from that list. */
  for (const [id, form] of Object.entries(ssr.FORMS)) {
    const endpoint = form.endpoint;
    if (!endpoint || (endpoint.startsWith("/") && !endpoint.startsWith("//"))) continue;
    let origin = null;
    try {
      origin = new URL(endpoint).origin;
    } catch {
      origin = null;
    }
    if (!origin || !APPROVED_ORIGINS.connect.includes(origin))
      fail(
        `form "${id}" posts to ${endpoint}, which is not same-origin or an approved connect origin`
      );
  }

  /* Document 22: the donation endpoints — same rule as a form endpoint. */
  if (checkout.enabled) {
    const api = checkout.api;
    if (!(api.startsWith("/") && !api.startsWith("//"))) {
      let origin = null;
      try {
        origin = new URL(api).origin;
      } catch {
        origin = null;
      }
      if (!origin || !APPROVED_ORIGINS.connect.includes(origin))
        fail(`VITE_DONATIONS_API (${api}) is not same-origin or an approved connect origin`);
    }
  }
  /* No published page may reference Razorpay directly: Checkout is loaded
     by script, on the donation page, on demand (lib/donations.js). */
  const razorpayInHtml = obs.thirdPartyOrigins.filter((o) =>
    [...RAZORPAY.script, ...RAZORPAY.frame, ...RAZORPAY.connect].includes(o)
  );
  if (razorpayInHtml.length)
    fail(`a published page references ${razorpayInHtml.join(", ")} directly`);

  const unapproved = obs.thirdPartyOrigins.filter(
    (o) => !approvedOriginList().includes(o)
  );
  if (unapproved.length)
    fail(`unapproved third-party origin(s) in published pages: ${unapproved.join(", ")}`);
  await writeFile(
    join(metaDir, "security-headers.json"),
    JSON.stringify(
      {
        mode: reportOnly ? "report-only" : "enforce",
        inlineHashed: {
          scripts: inline.scripts.length,
          styleAttributes: inline.styles.length,
        },
        donationCheckout: checkout.enabled
          ? { page: CHECKOUT_ROUTE, script: RAZORPAY.script, frame: RAZORPAY.frame, connect: RAZORPAY.connect }
          : false,
        headers: securityHeaders(inline, { reportOnly, checkout: checkout.enabled }),
      },
      null,
      2
    ) + "\n"
  );
  await writeFile(
    join(metaDir, "observability.json"),
    JSON.stringify(obs, null, 2) + "\n"
  );
  const enabled = Object.entries(obs.streams)
    .filter(([, s]) => s.enabledInThisBuild)
    .map(([n]) => n);

  /* No stand-in domain may ship (Document 15 §11). Pages, sitemap and
     robots.txt must name no local or example host at all; the JS bundle
     legitimately contains "http://localhost" (React Router's internal
     URL-parsing base, never output), so there only example domains
     count. */
  for (const file of await htmlFiles(dist)) {
    const text = await readFile(file, "utf8");
    const pattern = file.endsWith(".js")
      ? /https?:\/\/(www\.)?example\.(com|org|net)\b/
      : /https?:\/\/(localhost|127\.0\.0\.1|(www\.)?example\.(com|org|net))\b/;
    const bad = text.match(pattern);
    if (bad) fail(`placeholder origin ${bad[0]} in ${file.slice(root.length + 1)}`);
  }

  /* Document 24, as Document 27 redraws it. The SAFETY gate fails the
     build: a credential, a file that must never be published or a
     development route is never acceptable, in any environment. */
  const problems = await productionGate(dist, { routes });
  if (problems.length)
    fail(
      `release safety gate failed (${problems.length}):\n  - ${problems
        .slice(0, 20)
        .map((p) => `${p.file}: ${p.rule}`)
        .join("\n  - ")}`
    );

  /* Whether the FINAL production content has replaced the working
     placeholders is a RELEASE question, not a build error — every normal
     build legitimately carries them. It is recorded for
     scripts/release-status.mjs and summarised below. */
  const readinessFindings = await contentReadiness(dist, { routes });
  /* Document 24: the readiness facts, and a non-sensitive revision of
     this build — a hash of the content files and assets (never their
     text) plus the git commit if there is one — so an approved release
     candidate can be identified and a post-freeze change noticed. */
  await writeFile(join(metaDir, "readiness.json"), JSON.stringify(ssr.readiness(), null, 2) + "\n");
  await writeFile(
    join(metaDir, "build-revision.json"),
    JSON.stringify(await buildRevision(), null, 2) + "\n"
  );

  /* The working-placeholder findings, for scripts/release-status.mjs. */
  await writeFile(
    join(metaDir, "content-readiness.json"),
    JSON.stringify(
      {
        placeholders: readinessFindings.length,
        rules: [...new Set(readinessFindings.map((f) => f.rule))].sort(),
        files: [...new Set(readinessFindings.map((f) => f.file))].sort().slice(0, 100),
      },
      null,
      2
    ) + "\n"
  );

  await rm(ssrDir, { recursive: true, force: true });
  console.log(
    `✓ prerendered ${routes.length} routes, 404.html and ${redirects.length} redirects` +
      (sitemap
        ? "; sitemap.xml written"
        : "; no sitemap.xml (no verified production origin)") +
      `\n  content: ${Object.entries(check.counts)
        .map(([k, n]) => `${n} ${k}`)
        .join(", ")} approved` +
      `${
        readinessFindings.length
          ? `\n  ⚠ working placeholder content in ${
              new Set(readinessFindings.map((f) => f.file)).size
            } file(s) — final RBB content not yet in (npm run release:status)`
          : ""
      }` +
      `; ${heldBack} record${heldBack === 1 ? "" : "s"} held back by the publishing filter` +
      `${check.warnings.length ? `; ${check.warnings.length} warning(s)` : ""}` +
      `\n  measurement: ${enabled.length ? `${enabled.join(", ")} ENABLED` : "none enabled"}` +
      `; third-party origins: ${obs.thirdPartyOrigins.join(", ") || "none"}`
  );
} catch (error) {
  fail(error?.stack ?? String(error));
}
