import type { Db } from "mongodb";
import type { Event, Metric, Post, Program, Project, Report, TeamMember } from "@rbb/content-schema";
import type { AuthContext } from "../../../src/modules/auth/types.ts";
import { COLLECTIONS } from "../../../src/db/collections.ts";
import type { Logger } from "../../../src/logging/logger.ts";
import { AuditService, mongoAuditStore } from "../../../src/modules/audit/audit.ts";
import { mongoAuthStores } from "../../../src/modules/auth/repository.ts";
import { AboutService, MongoAboutStore } from "../../../src/modules/about/service.ts";
import { CareersService, MongoCareersStore } from "../../../src/modules/careers/service.ts";
import { MongoContentStore } from "../../../src/modules/content/repository.ts";
import { ContentService } from "../../../src/modules/content/service.ts";
import { eventCollection } from "../../../src/modules/events/service.ts";
import { ImpactService, MongoImpactStore } from "../../../src/modules/impact/service.ts";
import { MongoMediaStore } from "../../../src/modules/media/repository.ts";
import { MediaService } from "../../../src/modules/media/service.ts";
import { R2Storage } from "../../../src/modules/media/r2.ts";
import { MetricService } from "../../../src/modules/metrics/service.ts";
import { POST_TYPES, postCollection } from "../../../src/modules/posts/service.ts";
import { ProgramService } from "../../../src/modules/programs/service.ts";
import { ProjectService } from "../../../src/modules/projects/service.ts";
import { publishLock } from "../../../src/modules/publishing/lock.ts";
import { MongoPublishStore } from "../../../src/modules/publishing/repository.ts";
import { ReportService } from "../../../src/modules/reports/service.ts";
import { MongoSettingsStore } from "../../../src/modules/settings/repository.ts";
import { SettingsService } from "../../../src/modules/settings/service.ts";
import { StoryService } from "../../../src/modules/stories/service.ts";
import { TeamService } from "../../../src/modules/team/service.ts";
import { MongoTransparencyStore, TransparencyService } from "../../../src/modules/transparency/service.ts";
import type { CollectionType, ExistingRecord, PageType, WriterClient } from "./writer.ts";

/* The writer's client: the API's own services — validation, reference
   checks, audit — never a raw document. The same client drives the
   in-memory harness (tests) and the dedicated test database (the run). */

export const REHEARSAL_FACTS = { requestId: "migration-rehearsal", clientIp: null, userAgent: "rbb-migration-rehearsal" };

/* The services the writer uses: the test harness's names (test/settings/memory.ts). */
type View = { record: { id: string; slug?: string } & Record<string, unknown> };
interface Collection {
  list(auth: AuthContext, query: unknown): Promise<{ items: View[]; pagination: { totalPages: number } }>;
  create(auth: AuthContext, input: unknown, facts: typeof REHEARSAL_FACTS): Promise<View>;
}
interface Page {
  get(auth: AuthContext): Promise<{ record: ({ id: string } & Record<string, unknown>) | null }>;
  create(auth: AuthContext, input: unknown, facts: typeof REHEARSAL_FACTS): Promise<{ record: ({ id: string } & Record<string, unknown>) | null }>;
}
export interface RehearsalServices {
  programs: Collection;
  metrics: Collection;
  reports: Collection;
  projects: Collection;
  team: Collection;
  stories: Collection;
  posts: Collection;
  events: Collection;
  about: Page;
  impact: Page;
  transparency: Page;
  careers: Page;
  settings: {
    get(auth: AuthContext): Promise<{ settings: { id: string } & Record<string, unknown> } | null>;
    importInitial(record: unknown, by: { id: string | null; name: string }): Promise<{ created: boolean; problems: { path: string; message: string }[] }>;
  };
}

const COLLECTION_SERVICE: Record<CollectionType, [keyof RehearsalServices, string?]> = {
  program: ["programs"], metric: ["metrics"], report: ["reports"], project: ["projects"], team_member: ["team"],
  story: ["stories"], news: ["posts", "news"], blog: ["posts", "blog"], event: ["events"],
};

export function serviceClient(
  services: RehearsalServices,
  auth: AuthContext,
  media: { library: () => Promise<{ id: string; originalFilename: string; size: number }[]>; upload: WriterClient["upload"] }
): WriterClient {
  const collection = (type: CollectionType) => services[COLLECTION_SERVICE[type][0]] as Collection;
  return {
    async list(type) {
      const out: ExistingRecord[] = [];
      for (let page = 1; ; page++) {
        const postType = COLLECTION_SERVICE[type][1];
        const { items, pagination } = await collection(type).list(auth, { pageSize: 100, page, ...(postType && { type: postType }) });
        out.push(...items.map((v) => ({ id: v.record.id, slug: v.record.slug, record: v.record })));
        if (page >= pagination.totalPages) return out;
      }
    },
    async page(type: PageType) {
      if (type === "settings") {
        const view = await services.settings.get(auth);
        return view ? { id: view.settings.id, record: view.settings } : null;
      }
      const view = await services[type].get(auth);
      return view.record ? { id: view.record.id, record: view.record } : null;
    },
    async create(type, payload) {
      if (type === "settings") {
        const { created, problems } = await services.settings.importInitial(payload, { id: auth.user.id, name: "Migration rehearsal" });
        if (problems.length) throw new Error(`settings refused: ${problems.map((p) => `${p.path}: ${p.message}`).join("; ")}`);
        if (!created) throw new Error("settings already exist");
        return { id: (await services.settings.get(auth))!.settings.id };
      }
      if (type in COLLECTION_SERVICE) {
        const view = await collection(type as CollectionType).create(auth, payload, REHEARSAL_FACTS);
        return { id: view.record.id, slug: view.record.slug };
      }
      const view = await services[type as Exclude<PageType, "settings">].create(auth, payload, REHEARSAL_FACTS);
      return { id: view.record!.id };
    },
    media: media.library,
    upload: media.upload,
  };
}

/* The same services over the dedicated test database, built as
   src/app.ts builds them (keep the two in step). */
export function mongoServices(db: Db, orgId: string, { secret, log }: { secret: string; log: Logger }): RehearsalServices {
  const audit = new AuditService(mongoAuditStore(db, orgId), { orgId, secret, log });
  const media = new MongoMediaStore(db, orgId);
  const lock = publishLock(new MongoPublishStore(db, orgId));
  const options = { orgId, lock };
  const programs = new MongoContentStore<Program>(db, COLLECTIONS.programs, orgId, { dateField: "record.order" });
  const projects = new MongoContentStore<Project>(db, COLLECTIONS.projects, orgId, { dateField: "record.order" });
  const stories = new MongoContentStore<Post & { title: string }>(db, COLLECTIONS.posts, orgId, { types: ["story"] });
  return {
    programs: new ProgramService(programs, media, audit, options) as unknown as Collection,
    metrics: new MetricService(new MongoContentStore<Metric>(db, COLLECTIONS.metrics, orgId, { dateField: "record.order", titleField: "record.label" }), media, audit, options) as unknown as Collection,
    reports: new ReportService(new MongoContentStore<Report>(db, COLLECTIONS.reports, orgId, { dateField: "record.order" }), media, audit, options) as unknown as Collection,
    projects: new ProjectService(projects, media, { programs, stories }, audit, options) as unknown as Collection,
    team: new TeamService(new MongoContentStore<TeamMember>(db, COLLECTIONS.teamMembers, orgId, { dateField: "record.order", titleField: "record.name" }), media, audit, options) as unknown as Collection,
    stories: new StoryService(stories, media, { programs, projects }, audit, options) as unknown as Collection,
    posts: new ContentService(postCollection({ programs }), new MongoContentStore<Post & { title: string }>(db, COLLECTIONS.posts, orgId, { types: POST_TYPES }), media, audit, options) as unknown as Collection,
    events: new ContentService(eventCollection({ programs }), new MongoContentStore<Event>(db, COLLECTIONS.events, orgId), media, audit, options) as unknown as Collection,
    about: new AboutService(new MongoAboutStore(db, orgId), media, audit, options) as unknown as Page,
    impact: new ImpactService(new MongoImpactStore(db, orgId), media, { stories, programs }, audit, options) as unknown as Page,
    transparency: new TransparencyService(new MongoTransparencyStore(db, orgId), media, audit, options) as unknown as Page,
    careers: new CareersService(new MongoCareersStore(db, orgId), media, audit, options) as unknown as Page,
    settings: new SettingsService(new MongoSettingsStore(db, orgId), media, audit, { orgId }) as unknown as RehearsalServices["settings"],
  };
}

/* Media for the run: the organization's library (read), and uploads
   through the API's media service to the FAKE R2 only (a local,
   signature-checking stand-in: nothing reaches a real bucket). */
export function testMedia(db: Db, orgId: string, storage: R2Storage, auth: AuthContext, { secret, log }: { secret: string; log: Logger }) {
  const store = new MongoMediaStore(db, orgId);
  const audit = new AuditService(mongoAuditStore(db, orgId), { orgId, secret, log });
  const service = new MediaService(store, storage, audit, mongoAuthStores(db, orgId).throttle, { orgId, env: "test", log });
  return {
    library: async () => (await db.collection(COLLECTIONS.media).find({ orgId, deletedAt: null }, { projection: { _id: 0, id: 1, originalFilename: 1, size: 1 } }).toArray()) as unknown as { id: string; originalFilename: string; size: number }[],
    async upload({ filename, bytes, mimeType, alt, focal }: { filename: string; bytes: Buffer; mimeType: string; alt: string; focal?: string }) {
      const intent = await service.createUploadIntent(auth, { filename, mimeType, size: bytes.length }, REHEARSAL_FACTS);
      const put = await fetch(intent.uploadUrl, { method: "PUT", headers: intent.uploadHeaders, body: bytes });
      if (!put.ok) throw new Error(`test storage refused the upload (${put.status})`);
      const done = await service.complete(auth, intent.mediaId, REHEARSAL_FACTS);
      await service.updateMetadata(auth, intent.mediaId, { version: done.version, alt, ...(focal && { focal }) }, REHEARSAL_FACTS);
      return { id: intent.mediaId };
    },
  };
}
