/* Generates the responsive WebP copies in src/assets/responsive/ from the
   photographs the public pages show — Document 15.

   ONE image source for the whole site (Document 27): every photograph a
   page renders — whether it is RBB's own or a temporary placeholder — is
   a normal file in src/assets/, processed here into src/assets/responsive/
   the same way. There is no separate demo image tree or staging-only
   pipeline; a photograph that is still a placeholder is just an ordinary
   working image until it is replaced.

   NOT part of the build: the copies are committed, so building needs no
   image tooling. Re-run only when a source photograph is added or
   replaced. It uses a headless Chromium's own WebP encoder (canvas), so it
   needs Playwright, which is not a project dependency:

     npx -p playwright node scripts/responsive-images.mjs
     (first time: npx playwright install chromium)

   Output per source: <name>-<width>.webp at each width below the source's
   own (never upscaled), plus manifest.json with the source's natural size
   for width/height attributes. Same photograph, smaller file — never a
   different or new image. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { requirePlaywright } from "./lib/playwright.mjs";

const { chromium } = await requirePlaywright("scripts/responsive-images.mjs");

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "src/assets");
const out = join(assets, "responsive");
await mkdir(out, { recursive: true });

/* Every photograph a public page renders. Add one here when a page starts
   showing it. */
const SOURCES = [
  "rbb-field-kids.jpg",
  "rbb-field-distribution.jpg",
  "rbb-field-elder.jpg",
  "ngo-volunteers.jpg",
  "ngo-events.jpg",
  "gifts-hero.jpg",
  "zakat-hero.jpg",
  "ngo-classroom.jpg",
  "demo-comm-aid-boxes.jpg",
  "demo-comm-food-prep.jpg",
  "demo-comm-gathering.jpg",
  "demo-comm-packing.jpg",
  "demo-comm-relief-packing.jpg",
  "demo-edu-girl-reading.jpg",
  "demo-edu-reading-circle.jpg",
  "demo-edu-rural-classroom.jpg",
  "demo-edu-teacher-classroom.jpg",
  "demo-health-checkup.jpg",
  "demo-health-drinking-water.jpg",
  "demo-health-team.jpg",
  "demo-health-water-pump.jpg",
  "demo-live-harvest.jpg",
  "demo-live-market.jpg",
  "demo-live-sewing.jpg",
  "demo-live-vegetable-seller.jpg",
  "demo-team-1.jpg",
  "demo-team-2.jpg",
  "demo-team-3.jpg",
  "demo-team-4.jpg",
  "demo-team-5.jpg",
  "demo-team-6.jpg",
];
const WIDTHS = [480, 800, 1200, 1600];
const QUALITY = 0.78;

const browser = await chromium.launch();
const page = await browser.newPage();
const manifest = {};
for (const file of SOURCES) {
  const data = (await readFile(join(assets, file))).toString("base64");
  const results = await page.evaluate(
    async ({ data, widths, quality }) => {
      const img = new Image();
      img.src = `data:image/jpeg;base64,${data}`;
      await img.decode();
      const made = [];
      for (const w of widths
        .filter((w) => w < img.naturalWidth)
        .concat(img.naturalWidth)) {
        const h = Math.round((img.naturalHeight * w) / img.naturalWidth);
        const canvas = Object.assign(document.createElement("canvas"), {
          width: w,
          height: h,
        });
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);
        made.push({ w, url: canvas.toDataURL("image/webp", quality) });
      }
      return { width: img.naturalWidth, height: img.naturalHeight, made };
    },
    { data, widths: WIDTHS, quality: QUALITY }
  );
  const name = file.replace(/\.\w+$/, "");
  manifest[name] = {
    width: results.width,
    height: results.height,
    widths: results.made.map((m) => m.w),
  };
  for (const { w, url } of results.made) {
    await writeFile(
      join(out, `${name}-${w}.webp`),
      Buffer.from(url.split(",")[1], "base64")
    );
  }
  console.log(name, manifest[name].widths.join(" "));
}
await writeFile(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
await browser.close();
