import type { Db, IndexDescription } from "mongodb";

/* Every collection the API uses, and the indexes each one needs. Indexes
   exist only for a query or a uniqueness rule the code actually has:

   users
     orgId_emailNormalized_unique  login looks a user up by email; one account per email per organization
     orgId_id_unique               lookup by user id (session → user)
   memberships
     orgId_userId_unique           one membership per user per organization; looked up on every request
     orgId_id_unique               membership identity
   sessions
     tokenHash_unique              every authenticated request looks its session up by token hash
     orgId_userId_expiresAt        "my active sessions"
     expiresAt_ttl                 MongoDB deletes a session once it has expired (the code never
                                   trusts this: expiry is checked on every request)
   setup_tokens
     tokenHash_unique              a setup link is looked up (and consumed) by its token's hash
     orgId_userId                  revoke a member's open links when a new one is issued
     expiresAt_ttl                 MongoDB deletes a link once it has expired (the code never
                                   trusts this: expiry is checked when the link is used)
   member_state
     orgId_unique                  ONE team-change lock document per organization (M17: the
                                   last-active-owner guard runs under it)
   audit_logs
     orgId_createdAt               the audit trail is read newest-first, per organization
   auth_throttle
     expiresAt_ttl                 login throttle counters disappear when their window ends
                                   (also counts media upload intents per member)
   media
     orgId_id_unique               lookup/update by media id — what content references
     orgId_objectKey_unique        one record per stored object; a key is never reused
     orgId_status_createdAt_id     the library list: newest/oldest first, by status or all
                                   non-deleted; cleanup finds stale pending uploads
     orgId_objectState             deletions whose storage cleanup is still to be confirmed
   site_settings
     orgId_unique                  ONE working settings record per organization
   published_snapshots
     orgId_version_unique          one immutable snapshot per version; read by version
   publish_state
     orgId_unique                  ONE pointer/counter/lock document per organization
   posts / events                  (the contract record is under `record`)
     orgId_id_unique               lookup/update by content id
     orgId_slug_unique             an address belongs to one record in the organization
     orgId_status_date             published records for a snapshot; lists by status, by date
     orgId_updatedAt               the admin list's default order (recently edited first)
   appeals                         (the contract record is under `record`, as posts/events)
     orgId_id_unique               lookup/update by content id
     orgId_slug_unique             an address belongs to one appeal in the organization
     orgId_status_updatedAt        the admin list filtered by status, recently edited first;
                                   published appeals for a snapshot
     orgId_updatedAt               the admin list's default order
     orgId_publishedAt             the admin list sorted by publish date
   general_donation_pages
     orgId_unique                  ONE general donation page per organization
   homepages
     orgId_unique                  ONE homepage per organization (the record under `record`)
     orgId_status                  the published homepage, for a snapshot
     orgId_updatedAt               when it was last edited
   about_pages                     (as homepages)
     orgId_unique                  ONE About page per organization
     orgId_status                  the published About page, for a snapshot
     orgId_updatedAt               when it was last edited
   team_members                    (the contract record under `record`, as posts)
     orgId_id_unique               lookup/update by content id
     orgId_slug_unique             a profile address belongs to one member
     orgId_status_order            published members in team order, for a snapshot
     orgId_order                   the admin's team list, in order
   programs                        (the contract record under `record`, as posts)
     orgId_id_unique               lookup/update by content id
     orgId_slug_unique             a program's address (/work/<slug>) belongs to one program
     orgId_status_order            published programs in order, for a snapshot
     orgId_order                   the admin's program list, in order
   metrics                         (as programs) the headline figures
     orgId_id_unique               lookup/update by content id
     orgId_slug_unique             a figure's key (what stats blocks name) belongs to one figure
     orgId_status_order            published figures in order, for a snapshot
     orgId_order                   the admin's figure list, in order
   reports                         (as programs) transparency documents
     orgId_id_unique               lookup/update by content id
     orgId_slug_unique             a document's key belongs to one document
     orgId_status_order            published documents in order, for a snapshot
     orgId_order                   the admin's document list, in order
   projects                        (as programs) the projects
     orgId_id_unique               lookup/update by content id
     orgId_slug_unique             a project's address (/work/projects/<slug>) belongs to one project
     orgId_status_order            published projects in order, for a snapshot
     orgId_order                   the admin's project list, in order
   (stories, M12, are posts of type "story": the posts collection and its
   indexes — an address is unique across all posts)
   careers_pages                   the Careers page (M13)
     orgId_unique                  ONE Careers page per organization — its only
                                   query (read, save and publish all go by orgId)
   how_we_work_pages               the How We Work page (#7)
     orgId_unique                  ONE How We Work page per organization —
                                   its only query, as careers_pages
   policies                        the site policies (M19): privacy, terms,
                                   donation — at most one of each per
                                   organization, the policy's id in `policyId`
     orgId_policyId_unique         ONE record per policy per organization — its
                                   only query (read, save and publish all go by
                                   orgId and policyId)
   form_submissions                what visitors send through the website's
                                   Contact, Volunteer and Partner forms
                                   (2026-10-13) — kept until an owner deletes
     orgId_id_unique               one submission, by id
     orgId_createdAt               the admin's list, newest first (and its
                                   date filter)
     orgId_formId_createdAt        the list filtered by form
     orgId_status_createdAt        the list filtered by new / read
   story_strips                    Highlights — the story strip (M23)
     orgId_unique                  ONE strip per organization — its only query
   popups                          the site popup (M22)
     orgId_unique                  ONE popup per organization — its only query
   announcement_bars               the announcement bar (M21)
     orgId_unique                  ONE bar per organization — its only query
   get_involved_pages              the Get Involved pages (M20): the hub and
                                   the four paths — at most one of each per
                                   organization, the page's id in `pageId`
     orgId_pageId_unique           ONE record per page per organization — its
                                   only query (read, save and publish all go by
                                   orgId and pageId)
   impact_pages                    (as homepages)
     orgId_unique                  ONE Impact page per organization
     orgId_status                  the published Impact page, for a snapshot
     orgId_updatedAt               when it was last edited
   transparency_pages              (as homepages)
     orgId_unique                  ONE Transparency record per organization
     orgId_status                  the published record, for a snapshot
     orgId_updatedAt               when it was last edited

   Every index that can start with orgId does, so organizations stay
   separate even in a shared database. */
export const COLLECTIONS = {
  appeals: "appeals",
  users: "users",
  memberships: "memberships",
  sessions: "sessions",
  memberState: "member_state",
  setupTokens: "setup_tokens",
  auditLogs: "audit_logs",
  authThrottle: "auth_throttle",
  media: "media",
  siteSettings: "site_settings",
  publishedSnapshots: "published_snapshots",
  publishState: "publish_state",
  posts: "posts",
  events: "events",
  generalDonationPages: "general_donation_pages",
  homepages: "homepages",
  aboutPages: "about_pages",
  teamMembers: "team_members",
  programs: "programs",
  metrics: "metrics",
  reports: "reports",
  projects: "projects",
  careersPages: "careers_pages",
  howWeWorkPages: "how_we_work_pages",
  policies: "policies",
  getInvolvedPages: "get_involved_pages",
  announcementBars: "announcement_bars",
  popups: "popups",
  storyStrips: "story_strips",
  impactPages: "impact_pages",
  transparencyPages: "transparency_pages",
  formSubmissions: "form_submissions",
} as const;

export const INDEXES: Record<keyof typeof COLLECTIONS, IndexDescription[]> = {
  appeals: [
    { name: "orgId_id_unique", key: { orgId: 1, "record.id": 1 }, unique: true },
    { name: "orgId_slug_unique", key: { orgId: 1, "record.slug": 1 }, unique: true },
    { name: "orgId_status_updatedAt", key: { orgId: 1, "record.status": 1, updatedAt: -1 } },
    { name: "orgId_updatedAt", key: { orgId: 1, updatedAt: -1 } },
    { name: "orgId_publishedAt", key: { orgId: 1, "record.publishedAt": -1 } },
  ],
  users: [
    { name: "orgId_emailNormalized_unique", key: { orgId: 1, emailNormalized: 1 }, unique: true },
    { name: "orgId_id_unique", key: { orgId: 1, id: 1 }, unique: true },
  ],
  memberships: [
    { name: "orgId_userId_unique", key: { orgId: 1, userId: 1 }, unique: true },
    { name: "orgId_id_unique", key: { orgId: 1, id: 1 }, unique: true },
  ],
  sessions: [
    { name: "tokenHash_unique", key: { tokenHash: 1 }, unique: true },
    { name: "orgId_userId_expiresAt", key: { orgId: 1, userId: 1, expiresAt: 1 } },
    { name: "expiresAt_ttl", key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
  auditLogs: [{ name: "orgId_createdAt", key: { orgId: 1, createdAt: -1 } }],
  authThrottle: [{ name: "expiresAt_ttl", key: { expiresAt: 1 }, expireAfterSeconds: 0 }],
  media: [
    { name: "orgId_id_unique", key: { orgId: 1, id: 1 }, unique: true },
    { name: "orgId_objectKey_unique", key: { orgId: 1, objectKey: 1 }, unique: true },
    { name: "orgId_status_createdAt_id", key: { orgId: 1, status: 1, createdAt: -1, id: -1 } },
    { name: "orgId_objectState", key: { orgId: 1, objectState: 1 } },
  ],
  siteSettings: [{ name: "orgId_unique", key: { orgId: 1 }, unique: true }],
  publishedSnapshots: [{ name: "orgId_version_unique", key: { orgId: 1, version: 1 }, unique: true }],
  publishState: [{ name: "orgId_unique", key: { orgId: 1 }, unique: true }],
  memberState: [{ name: "orgId_unique", key: { orgId: 1 }, unique: true }],
  setupTokens: [
    { name: "tokenHash_unique", key: { tokenHash: 1 }, unique: true },
    { name: "orgId_userId", key: { orgId: 1, userId: 1 } },
    { name: "expiresAt_ttl", key: { expiresAt: 1 }, expireAfterSeconds: 0 },
  ],
  posts: [
    { name: "orgId_id_unique", key: { orgId: 1, "record.id": 1 }, unique: true },
    { name: "orgId_slug_unique", key: { orgId: 1, "record.slug": 1 }, unique: true },
    { name: "orgId_status_date", key: { orgId: 1, "record.status": 1, "record.date": -1 } },
    { name: "orgId_updatedAt", key: { orgId: 1, updatedAt: -1 } },
  ],
  events: [
    { name: "orgId_id_unique", key: { orgId: 1, "record.id": 1 }, unique: true },
    { name: "orgId_slug_unique", key: { orgId: 1, "record.slug": 1 }, unique: true },
    { name: "orgId_status_date", key: { orgId: 1, "record.status": 1, "record.date": -1 } },
    { name: "orgId_updatedAt", key: { orgId: 1, updatedAt: -1 } },
  ],
  generalDonationPages: [{ name: "orgId_unique", key: { orgId: 1 }, unique: true }],
  homepages: [
    { name: "orgId_unique", key: { orgId: 1 }, unique: true },
    { name: "orgId_status", key: { orgId: 1, "record.status": 1 } },
    { name: "orgId_updatedAt", key: { orgId: 1, updatedAt: -1 } },
  ],
  aboutPages: [
    { name: "orgId_unique", key: { orgId: 1 }, unique: true },
    { name: "orgId_status", key: { orgId: 1, "record.status": 1 } },
    { name: "orgId_updatedAt", key: { orgId: 1, updatedAt: -1 } },
  ],
  teamMembers: [
    { name: "orgId_id_unique", key: { orgId: 1, "record.id": 1 }, unique: true },
    { name: "orgId_slug_unique", key: { orgId: 1, "record.slug": 1 }, unique: true },
    { name: "orgId_status_order", key: { orgId: 1, "record.status": 1, "record.order": 1, "record.id": 1 } },
    { name: "orgId_order", key: { orgId: 1, "record.order": 1, "record.id": 1 } },
  ],
  programs: [
    { name: "orgId_id_unique", key: { orgId: 1, "record.id": 1 }, unique: true },
    { name: "orgId_slug_unique", key: { orgId: 1, "record.slug": 1 }, unique: true },
    { name: "orgId_status_order", key: { orgId: 1, "record.status": 1, "record.order": 1, "record.id": 1 } },
    { name: "orgId_order", key: { orgId: 1, "record.order": 1, "record.id": 1 } },
  ],
  metrics: [
    { name: "orgId_id_unique", key: { orgId: 1, "record.id": 1 }, unique: true },
    { name: "orgId_slug_unique", key: { orgId: 1, "record.slug": 1 }, unique: true },
    { name: "orgId_status_order", key: { orgId: 1, "record.status": 1, "record.order": 1, "record.id": 1 } },
    { name: "orgId_order", key: { orgId: 1, "record.order": 1, "record.id": 1 } },
  ],
  reports: [
    { name: "orgId_id_unique", key: { orgId: 1, "record.id": 1 }, unique: true },
    { name: "orgId_slug_unique", key: { orgId: 1, "record.slug": 1 }, unique: true },
    { name: "orgId_status_order", key: { orgId: 1, "record.status": 1, "record.order": 1, "record.id": 1 } },
    { name: "orgId_order", key: { orgId: 1, "record.order": 1, "record.id": 1 } },
  ],
  projects: [
    { name: "orgId_id_unique", key: { orgId: 1, "record.id": 1 }, unique: true },
    { name: "orgId_slug_unique", key: { orgId: 1, "record.slug": 1 }, unique: true },
    { name: "orgId_status_order", key: { orgId: 1, "record.status": 1, "record.order": 1, "record.id": 1 } },
    { name: "orgId_order", key: { orgId: 1, "record.order": 1, "record.id": 1 } },
  ],
  careersPages: [{ name: "orgId_unique", key: { orgId: 1 }, unique: true }],
  howWeWorkPages: [{ name: "orgId_unique", key: { orgId: 1 }, unique: true }],
  policies: [{ name: "orgId_policyId_unique", key: { orgId: 1, policyId: 1 }, unique: true }],
  getInvolvedPages: [{ name: "orgId_pageId_unique", key: { orgId: 1, pageId: 1 }, unique: true }],
  announcementBars: [{ name: "orgId_unique", key: { orgId: 1 }, unique: true }],
  popups: [{ name: "orgId_unique", key: { orgId: 1 }, unique: true }],
  storyStrips: [{ name: "orgId_unique", key: { orgId: 1 }, unique: true }],
  formSubmissions: [
    { name: "orgId_id_unique", key: { orgId: 1, id: 1 }, unique: true },
    { name: "orgId_createdAt", key: { orgId: 1, createdAt: -1, id: -1 } },
    { name: "orgId_formId_createdAt", key: { orgId: 1, formId: 1, createdAt: -1, id: -1 } },
    { name: "orgId_status_createdAt", key: { orgId: 1, status: 1, createdAt: -1, id: -1 } },
  ],
  impactPages: [
    { name: "orgId_unique", key: { orgId: 1 }, unique: true },
    { name: "orgId_status", key: { orgId: 1, "record.status": 1 } },
    { name: "orgId_updatedAt", key: { orgId: 1, updatedAt: -1 } },
  ],
  transparencyPages: [
    { name: "orgId_unique", key: { orgId: 1 }, unique: true },
    { name: "orgId_status", key: { orgId: 1, "record.status": 1 } },
    { name: "orgId_updatedAt", key: { orgId: 1, updatedAt: -1 } },
  ],
};

/* M2 stored appeals flat ({ orgId, id, slug, … }); since M7 an appeal is
   a content document like a post ({ orgId, record: { id, slug, … } }).
   M2's two unique indexes keyed the flat fields under the names the new
   ones use, and would make every new-shape appeal collide on a null slug.
   They are replaced — only while no flat (M2-shaped) appeal exists. A
   database that still holds one is refused, never silently rewritten. */
const LEGACY_APPEAL_KEYS: Record<string, Record<string, number>> = {
  orgId_slug_unique: { orgId: 1, slug: 1 },
  orgId_id_unique: { orgId: 1, id: 1 },
};

async function retireLegacyAppealIndexes(db: Db): Promise<string[]> {
  const collection = db.collection(COLLECTIONS.appeals);
  const existing = await collection.indexes().catch((error: { codeName?: string }) => {
    if (error.codeName === "NamespaceNotFound") return [];
    throw error;
  });
  const legacy = existing.filter((index) => index.name && JSON.stringify(index.key) === JSON.stringify(LEGACY_APPEAL_KEYS[index.name]));
  if (!legacy.length) return [];
  if (await collection.countDocuments({ record: { $exists: false } }, { limit: 1 }))
    throw new Error("The appeals collection still holds M2-shaped appeals (no `record`). Migrate them before creating the M7 indexes; nothing was changed.");
  for (const index of legacy) await collection.dropIndex(index.name!);
  return legacy.map((index) => index.name!);
}

/* Creates any missing index. Idempotent — an index that already exists
   with the same definition is left as it is — and never drops or rewrites
   anything (the one exception: M2's appeal indexes, above): an existing
   index with a conflicting definition makes MongoDB refuse, and the error
   is reported instead. */
export async function ensureIndexes(db: Db): Promise<Record<string, string[]>> {
  const created: Record<string, string[]> = {};
  await retireLegacyAppealIndexes(db);
  for (const [key, name] of Object.entries(COLLECTIONS) as [keyof typeof COLLECTIONS, string][]) {
    created[name] = await db.collection(name).createIndexes(INDEXES[key]);
  }
  return created;
}
