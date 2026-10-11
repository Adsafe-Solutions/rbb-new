/* M36 — LOCAL PREVIEW of what the next publish would put live: the
   website's own pages, drawn from the content owners have APPROVED but
   not published. For the owner's eyes, on this machine only.

     npm run preview:cms          (pnpm web:preview:cms from the root)

   1. Asks for the owner's email and password (the password is hidden,
      never stored, never put in an environment variable).
   2. Signs in to the API, reads GET /api/v1/publish/preview (owner-only:
      the candidate snapshot, never stored), and signs out again.
   3. Refuses unless the API names the expected database and this site's
      organization — a local API on a smoke or test database never feeds
      a preview.
   4. Writes build-meta/preview-snapshot.json (git-ignored) and starts the
      DEV SERVER with RBB_PREVIEW=1, which applies it and marks every page
      as a preview (scripts/vite-published-snapshot.mjs). Builds refuse
      that mode; the public site and published snapshots are untouched.
      The preview file is removed when the dev server stops.

   Local settings (all optional; nothing secret):
     RBB_PREVIEW_API      the API, default http://localhost:4000
     RBB_PREVIEW_ORIGIN   an Origin the API allows for sign-in (its
                          ADMIN_ORIGIN), default http://localhost:5174
     RBB_PREVIEW_DB       the database the API must be using,
                          default risingbeyondborders
     RBB_PREVIEW_PORT     the dev server's port, default 5180 */
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ORG_ID } from "../src/contract/org.js";
import { structuralProblems } from "./snapshot-adapter.mjs";
import { PREVIEW_FILE, PREVIEW_STATUS_FILE } from "./vite-published-snapshot.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* https anywhere; plain http only to this machine. */
export const allowedApi = (value) => {
  try {
    const url = new URL(value);
    return !url.username && !url.password && (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
  } catch {
    return false;
  }
};

/* Why this API answer must not become a preview; empty = it may. */
export function previewProblems(data, { database, organization }) {
  if (!data || data.preview !== true) return ["the API did not answer with a preview"];
  const problems = [];
  if (data.target?.database !== database) problems.push(`the API is using database "${data.target?.database ?? "unknown"}", not "${database}" — start it against ${database}`);
  if (data.target?.organization !== organization) problems.push(`the API is for organization "${data.target?.organization ?? "unknown"}", not "${organization}"`);
  if (data.problems?.length) problems.push(...data.problems.map((p) => `the next publish would be refused: ${p.path}: ${p.message}`));
  if (!data.snapshot) problems.push("there is no snapshot to preview");
  else problems.push(...structuralProblems(data.snapshot, { orgId: organization }));
  return problems;
}

function hiddenPrompt(question) {
  return new Promise((done, fail) => {
    const stdin = process.stdin;
    process.stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return done(value);
        }
        if (char === "\u0003") {
          stdin.setRawMode(false);
          return fail(new Error("Cancelled"));
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const api = (process.env.RBB_PREVIEW_API ?? "http://localhost:4000").replace(/\/$/, "");
  const origin = process.env.RBB_PREVIEW_ORIGIN ?? "http://localhost:5174";
  const database = process.env.RBB_PREVIEW_DB ?? "risingbeyondborders";
  const port = process.env.RBB_PREVIEW_PORT ?? "5180";
  if (!allowedApi(api)) throw new Error("RBB_PREVIEW_API must be https, or http on localhost, with no credentials in it.");
  if (!process.stdin.isTTY) throw new Error("Run this in a terminal: it asks for the owner's password.");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const email = (await rl.question("Owner email: ")).trim();
  rl.close();
  const password = await hiddenPrompt("Password (hidden): ");

  const login = await fetch(`${api}/api/v1/auth/login`, { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!login.ok) throw new Error(`sign-in refused (${login.status}). Check the email and password, and that the API allows the origin ${origin}.`);
  const cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];
  let data;
  try {
    const res = await fetch(`${api}/api/v1/publish/preview`, { headers: { Cookie: cookie } });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`preview refused (${res.status}): ${body?.error?.message ?? "no details"}`);
    data = body.data;
  } finally {
    await fetch(`${api}/api/v1/auth/logout`, { method: "POST", headers: { Origin: origin, Cookie: cookie } }).catch(() => {});
  }

  const problems = previewProblems(data, { database, organization: ORG_ID });
  if (problems.length) throw new Error(`no preview:\n  - ${problems.join("\n  - ")}`);

  const keys = Object.keys(data.snapshot.content ?? {});
  await mkdir(join(root, "build-meta"), { recursive: true });
  await writeFile(join(root, PREVIEW_FILE), JSON.stringify(data.snapshot));
  await writeFile(join(root, PREVIEW_STATUS_FILE), JSON.stringify({ basedOnVersion: data.basedOnVersion, database, organization: ORG_ID, content: keys, at: new Date().toISOString() }, null, 2) + "\n");
  console.log(`\n  preview: ${database} / ${ORG_ID}, live version ${data.basedOnVersion ?? "none"} + approved changes`);
  console.log(`  content: ${keys.join(", ") || "(none beyond the site's own)"}`);
  console.log(`  open http://localhost:${port}/ — every page says LOCAL PREVIEW. Ctrl+C stops it and removes the preview file.\n`);

  const vite = spawn(process.execPath, [join(root, "node_modules/vite/bin/vite.js"), "--port", port, "--strictPort"], { cwd: root, stdio: "inherit", env: { ...process.env, RBB_PREVIEW: "1" } });
  const cleanUp = async () => {
    await rm(join(root, PREVIEW_FILE), { force: true });
    await rm(join(root, PREVIEW_STATUS_FILE), { force: true });
  };
  process.on("SIGINT", () => vite.kill("SIGINT"));
  vite.on("close", async (code) => {
    await cleanUp();
    process.exit(code ?? 0);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  main().catch((error) => {
    console.error(`\n✗ ${error.message}\n`);
    process.exit(1);
  });
