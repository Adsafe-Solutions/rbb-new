# Media library (M4, M16)

How media upload, storage and management work, what R2 needs, and the
decisions behind the rules. Code: `apps/api/src/modules/media/` (API) and
`apps/admin/src/media/` plus `src/pages/media/` (admin).

## Flow

```
Admin browser ── POST /api/v1/media/upload-intents ─▶ API   checks session, media:write, name/type/size;
                                                            creates a PENDING record; signs a PUT URL
              ◀── { mediaId, uploadUrl, uploadHeaders, objectKey, expiresAt }
Admin browser ── PUT <presigned URL> (the file) ────▶ R2    signature binds key, type, length, 5-minute expiry
Admin browser ── POST /api/v1/media/:id/complete ───▶ API   HEAD + first 64 KiB from R2: size must match,
                                                            bytes must BE the declared image type;
                                                            dimensions read from the file → READY + publicUrl
```

- **File bytes never pass through the API.** Its request bodies are capped at
  8 KiB.
- **The browser never holds a storage credential.** It gets one single-use URL
  for one new object, and drops it once the upload is used.
- **If the PUT fails or is cancelled,** the admin calls
  `POST /api/v1/media/:id/abort`, and the record becomes `failed`.

## Records and lifecycle

The MongoDB collection is `media`. Every query is scoped by `orgId`, and the
organization comes from the server-side session, never from the request.

```
pending ──complete (verified)──▶ ready
   └──abort / rejected / abandoned──▶ failed
pending, ready, failed ──delete──▶ deleted   (terminal; the record is kept)
```

- **Fields:**
  - identity and status: `id`, `orgId`, `status`, `kind`
  - storage: `objectKey`, `objectState`, `publicUrl`
  - file: `originalFilename`, `mimeType`, `size`, `width`, `height`
  - editable: `alt`, `caption`, `focal`, `credit`, `license`, `consent`
    (`unknown | not-required | obtained | not-obtained`)
  - who and when: `createdBy`/`updatedBy`, `createdAt`/`updatedAt`,
    `completedAt`, `failedAt`, `failureReason`, `deletedAt`/`deletedBy`
  - concurrency and schema: `version`, `schemaVersion`
- **Editable fields:** only `alt`, `caption`, `focal`, `credit`, `license`
  and `consent`, and only with the current `version` (optimistic
  concurrency). Nothing can change `orgId`, `objectKey`, `createdBy` or
  `createdAt`.
- **Focal point and caption (Milestone 2):**
  - `focal` is the point to keep in frame when a page crops the image:
    `"X% Y%"` — horizontal then vertical, whole percentages 0–100, one
    space (CSS `object-position`; `FocalPoint` in `@rbb/content-schema`).
    `null`, or no field at all on records saved before Milestone 2, means
    centred. Anything else is refused by name; `null` clears it. The admin
    edits it as two numbers or a click on the preview; nothing sets it
    automatically.
  - `caption` (plain text, up to 1000) is **published**: a publish copies
    `focal` and a non-empty `caption` into the snapshot's `media` entry, and
    a change to either is a change to publish. `credit`, `license` and
    `consent` stay private.
  - The website draws the focal point on every cropped image of a library
    image, and the caption under the main image of a story, project, news or
    blog post and event, and under story gallery photographs. The website's
    own photographs keep exactly today's rendering (cards do not apply their
    `content/photos.js` focal points).
- **Content references:** content refers to media by `id`. That id matches
  `MediaId` in `@rbb/content-schema`. `toContentMedia()` maps a ready record
  onto the contract's `Media` shape, renaming `size` → `bytes`, `license` →
  `licence` and `originalFilename` → `filename`. Content never stores R2
  details.
- **Indexes** (in `apps/api/src/db/collections.ts`, created by
  `pnpm api:db:indexes`):
  - `orgId_id_unique`
  - `orgId_objectKey_unique`
  - `orgId_status_createdAt_id`
  - `orgId_objectState`

## Object keys

The format is `[_<env>/]<orgId>/media/<random uuid>/<safe-name>.<ext>`:
- **New key per upload.** The UUID is fresh for every upload, and it is not
  the record's id. So keys never collide, an upload never overwrites anything,
  and a key reveals no database identity.
- **Safe names.** `<safe-name>` is ASCII lowercase letters, digits and
  hyphens. It is derived from the original name, which is display-only and
  never put into a key. The extension comes from the *type*.
- **No path tricks.** Traversal (`../`), markup, unicode and empty names are
  all neutralised.
- **Immutable.** A key never changes; a rename would only edit metadata.
- **Non-production prefix.** Outside production, keys start with
  `_development/` or `_test/`, so local and test uploads stay out of the
  production namespace even in a shared bucket.

## Rules (`policy.ts`, the one place)

| Rule | Value | Why |
|---|---|---|
| Types | JPEG, PNG, WebP, AVIF (the admin sends WebP whenever converting helps) | Website images. The type is checked against the file's own bytes at completion, not just the claimed MIME type or the extension |
| SVG | **Refused** | An SVG can carry script, and served from the media domain it would run when opened directly. Safe handling (sanitising, or a sandbox CSP or download disposition on the bucket's domain) isn't designed yet. Use PNG/WebP for logos |
| Documents (PDF) | Not yet | Nothing on the site needs an uploaded document today. The content contract already knows `application/pdf`; adding it is one entry in `policy.ts` |
| Max size | 10 MiB | The largest image the site uses is 2.1 MB; 10 MiB covers an unoptimised phone photo. Enforced before a URL is issued, *signed into* the URL (Content-Length), and re-checked at completion |
| Max dimension | 20,000 px | Rejects decompression-bomb style images |
| Upload URL lifetime | 5 minutes | Starts the upload; a long transfer may run past it once begun |
| Intent rate limit | 100 per member per 10 minutes | Reuses the login throttle store. R2 PUT traffic itself never touches the API |
| Abandoned | Pending for more than 1 hour | Cleanup marks it failed and removes any object |

## Deletion

1. **Database first.** The status becomes `deleted`, `publicUrl` becomes
   null, and `objectState` becomes `deleting`. From this moment the record
   is never listed or returned.
2. **Storage second.** The R2 object is deleted, then `objectState` becomes
   `deleted`.
3. **If step 2 fails,** the record stays `deleting` and the response says
   `storage: "pending"`. `pnpm api:media:cleanup -- --apply` retries it.

Records are never removed from MongoDB.

### What deletion refuses (M16)

Before step 1, the API checks that nothing the website shows or is about to
show needs the image. The check runs on the server, under the publish lock,
so a publication and a deletion never interleave. While a publication is
running, a delete is refused with "A website publication is in progress".

A **ready** image is refused (`409 CONFLICT`) while any of these uses it:

- **the live website** — it is in the active published snapshot;
- **saved site settings** — for example the logo;
- **an approved, scheduled or published** record or page in any section.

The response lists where it is used (`details[].path = "usedBy"`), and the
admin shows that list. The refusal is audited as `media.delete_refused`,
with a count only.

Drafts and submissions do **not** block deletion. A draft that loses its
image can't be submitted or approved until it picks another one ("must be a
ready image"). So a deleted image never reaches the website. The check
lives in `PublishService.mediaUsage()`; the tests are in
`apps/api/test/media-usage.test.ts`.

Pending and failed records hold nothing public and can always be deleted.

**In the library (2026-10-13).** Every ready image says where it is used
(`usedBy` on `GET /api/v1/media` and `/:id`, from
`PublishService.mediaUsageMany()`, which reads everything once per page).
Tiles show **In use** or **Not in use**; the filter has both. A file nothing
uses gets a Delete button on its tile; the detail panel lists "Used by" and
disables Delete while the list is not empty. The API still decides.

## Cleanup

Run `pnpm api:build && pnpm api:media:cleanup`.
- **Default is a dry run:** it reports counts and changes nothing.
- `-- --apply` marks abandoned uploads failed and retries unconfirmed storage
  deletions.
- **Production** (the production database, whatever `NODE_ENV` says) needs
  the database's name, typed: `-- --production=risingbeyondborders` — even
  to report. A generic `--confirm` is not enough (apps/api README
  "Production safety").
- It runs on demand only; there is no scheduler yet.

## Optimising: WebP before upload (2026-10-13)

The admin converts every image to WebP **in the browser, before it uploads**
(`apps/admin/src/media/convert.ts`); the bytes still go straight to R2 and
the API checks what arrives as before.

- Quality 0.85 for photographs, 0.9 for PNG (graphics, transparency).
- Longest side at most **3200px** (the widest image the site draws is about
  1440px wide, so this stays sharp on 2× screens). Camera orientation is
  applied.
- The WebP is used when it is smaller, or when the image was scaled down.
  An original that is already WebP is re-encoded only for a 10%+ saving.
  Otherwise, or where the browser cannot encode WebP, the original uploads
  unchanged.
- Any format the browser can open is accepted that way (GIF, BMP…); SVG is
  still refused. Inputs over 60 MB are not tried (and then exceed the 10 MiB
  limit).
- Measured in Chromium: a 2.1 MB PNG became a 202 KB WebP (−90%); a
  6000×4000 photo became 3200×2133. Average pixel difference about 1–3 of
  255 — not visible.
- Images uploaded before this are unchanged.

## Image metadata (EXIF, GPS)

**A converted image carries no metadata**: the WebP is drawn from the
pixels, so EXIF (GPS location, time, camera) is not copied. **A file that
uploads as it is** (see above) is stored exactly as sent, metadata included:
the API reads only the file's header, to check its type and dimensions, and
never rewrites the image. A phone photo can carry EXIF data, including the
GPS location where it was taken, and that data is served publicly with it.

For files that upload unchanged:

- **Turn off location before uploading** photos of people, homes or
  programme sites. Use the phone's camera settings, or export the photo
  without location.
- **Prefer exported images.** Most image editors can drop location when
  exporting for the web. Uploaded media isn't processed by the website build;
  it is served exactly as stored.

Server-side stripping (for every file, whatever the browser) would need image
processing in the API; it is not built.

## Alt text: where it is required

Alt text lives on the media item, so describing an image once describes it
everywhere. It is **required** for these images:

- story images and galleries, project photographs, and team members'
  photographs;
- when they are submitted for review, and again by the snapshot contract when
  the website is built.

It is **not yet required** for images in these places:

- homepage, About and Impact blocks;
- site settings.

An undescribed image there is published, and drawn as decorative (`alt=""`).
Whether those blocks must also require alt text is an open decision. Some
images may be genuinely decorative.

## R2 setup (required before uploads work)

The API reads these variables. Configure all of them, or none; with none,
the media routes answer 503. Values are never logged, and problems are
reported by variable name. Only placeholders belong in `.env.example`.

| Variable | Secret | What |
|---|---|---|
| `R2_ACCOUNT_ID` | no | The Cloudflare account that owns the bucket |
| `R2_BUCKET` | no | The bucket's name |
| `R2_ACCESS_KEY_ID` | **yes** | The R2 API token's Access Key ID |
| `R2_SECRET_ACCESS_KEY` | **yes** | The R2 API token's Secret Access Key |
| `R2_PUBLIC_URL` | no | The bucket's **public** origin (a custom domain), never the S3 endpoint |
| `R2_S3_API` | no | Optional. Defaults to `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`. Only its origin is used, so a `/<bucket>` path is ignored |

### The R2 operations the API performs

These are the only R2 operations, and every one is signed by the API with
SigV4:

| Operation | When |
|---|---|
| `PutObject` (presigned) | The browser's upload, to one fresh key, with type and length signed in, for 5 minutes |
| `HeadObject` | At completion: size and type |
| `GetObject` (`Range: bytes=0-65535`) | At completion: the first 64 KiB, to check the bytes are the declared image |
| `DeleteObject` | When a file is rejected, aborted, abandoned or deleted |

The API never lists, configures or reads bucket settings. The public website
reads objects through `R2_PUBLIC_URL`, never through the API or the S3
endpoint.

### Three things to set in the Cloudflare dashboard

1. **Token permission: Object Read & Write on this bucket only.**
   - In R2 → *Manage R2 API Tokens*, create a token with **Object Read &
     Write**, and apply it to *specific buckets only*: `R2_BUCKET`.
   - Use its *Access Key ID* and *Secret Access Key*.
   - Not *Admin Read & Write*: the API doesn't need bucket management.
   - Without this permission, R2 answers `403 AccessDenied` to every request,
     including presigned uploads, and the admin shows "Upload failed. Please
     try again."
2. **Bucket CORS: the admin's origins, PUT, content-type.**
   - The browser PUTs directly to R2, so the bucket must allow the admin's
     origin.
   - Add one origin per admin deployment. `http://localhost:5174` is only for
     local development against the real bucket.
   - Never `*`.
   - The admin sends exactly one header (`Content-Type`) and no credentials.

   ```json
   [
     {
       "AllowedOrigins": ["https://admin.risingbeyondborders.org", "http://localhost:5174"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   `<img>` doesn't need CORS, so public reads through `R2_PUBLIC_URL` need no
   CORS rule. GET, HEAD and DELETE stay off the rule: only the API makes
   those calls, server-side.
3. **Public access through the custom domain.**
   - In the bucket's *Settings → Custom Domains*, connect the
     `R2_PUBLIC_URL` host.
   - Keep the `r2.dev` URL disabled.
   - Don't make the bucket otherwise public.
   - Objects are served at `<R2_PUBLIC_URL>/<object key>`.

The public website's CSP gets the media origin automatically: the build adds
each published image's origin to `img-src`, and nothing else. The admin has
no CSP.

### Verifying the real bucket

After the three steps above, run these against a **local test database**,
never the production one:

```sh
# 1. Storage and CORS, no browser. The script loads apps/api/.env, then
#    .env.local (the shell wins); only R2_* is read from them, nothing printed.
#    Uses _test/live-<random>/ keys and deletes every object it writes.
MONGODB_TEST_URI=… MONGODB_TEST_DB=risingbeyondborders_test \
R2_CORS_ORIGINS=https://admin.risingbeyondborders.org,http://localhost:5174 \
  pnpm api:test:r2

# 2. A real browser: the API on real R2 (pnpm api:dev, with MONGODB_DB set to
#    a throwaway database), the admin on :5174, then:
pnpm admin:smoke:media
pnpm admin:smoke:media-governance   # publishes the website in THAT database
pnpm admin:smoke:media-cors
```

`api:test:r2` checks:
- the presigned PUT;
- HEAD and the ranged GET;
- signature binding: type, length, expiry, and a refused unsigned PUT;
- service completion;
- the public URL answering `200` with the same bytes;
- delete;
- the CORS preflight for each admin origin, plus a refusal for a foreign
  origin, for DELETE, and for an extra header.

A CORS problem shows as "the bucket's CORS rule does not allow …". A
permission problem shows as "R2 refused the credentials (403 AccessDenied)".

## Testing

| What | How |
|---|---|
| Unit | `pnpm api:test`: SigV4 against AWS's published examples, policy and keys, signature sniffing for every format, service lifecycle, R2 client, config |
| Integration | `MONGODB_TEST_URI=… MONGODB_TEST_DB=risingbeyondborders_test pnpm api:test:integration`: HTTP routes on the dedicated test database, covering RBAC, CSRF, indexes, isolation between two organizations, audit |
| Live R2 | `MONGODB_TEST_URI=… MONGODB_TEST_DB=risingbeyondborders_test pnpm api:test:r2`: real uploads, verification and deletion under `_test/live-<random>/`; every object is deleted afterwards |
| Governance | `apps/api/test/media-usage.test.ts`: delete refused while used by the live site, settings, or approved, scheduled or published content; refused during a publication; lifecycle never leaks pending, failed or deleted media; alt text; organization isolation |
| Browser | `node apps/api/test/support/dev-server-fake-storage.ts`, then `pnpm admin:smoke:media`. The fake R2 checks every presigned PUT's signature as received from the browser, and answers CORS like the rule above |
| Browser (M16) | `pnpm admin:smoke:media-governance`: drag-and-drop and keyboard upload; empty, corrupt and mislabelled files; storage refusing the PUT; in-use deletion refused with "where"; 1440, 1024, 768 and 375 px with axe. `pnpm admin:smoke:media-cors`: a real browser's PUT allowed from the admin origin, and blocked from another origin or with an extra header |
