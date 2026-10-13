import { randomUUID } from "node:crypto";
import { ConfigError, describeEnvironment, loadConfig, type Config } from "./config/env.ts";
import { mediaKeyEnv } from "./config/target.ts";
import { COLLECTIONS } from "./db/collections.ts";
import { createMongoProvider, isDatabaseUnavailable, type MongoProvider } from "./db/mongo.ts";
import { ApiError, errors } from "./errors.ts";
import { BODY_LIMIT_BYTES } from "./http/body.ts";
import { corsHeaders, isAllowedOrigin, preflightHeaders } from "./http/cors.ts";
import { SECURITY_HEADERS, errorResponse } from "./http/response.ts";
import { createRouter, type Route } from "./http/router.ts";
import { createLogger, type Logger } from "./logging/logger.ts";
import { appealCollection } from "./modules/appeals/service.ts";
import { appealRoutes } from "./modules/appeals/routes.ts";
import { MongoDonationPageStore } from "./modules/donation-page/repository.ts";
import { donationPageRoutes } from "./modules/donation-page/routes.ts";
import { DonationPageService } from "./modules/donation-page/service.ts";
import { checkoutVerifier } from "./modules/donations/verify.ts";
import { MongoHomepageStore } from "./modules/homepage/repository.ts";
import { homepageRoutes } from "./modules/homepage/routes.ts";
import { HomepageService } from "./modules/homepage/service.ts";
import { AboutService, MongoAboutStore } from "./modules/about/service.ts";
import { blockPageRoutes } from "./modules/pages/routes.ts";
import { TeamService } from "./modules/team/service.ts";
import { teamRoutes } from "./modules/team/routes.ts";
import { ProgramService } from "./modules/programs/service.ts";
import { programRoutes } from "./modules/programs/routes.ts";
import { StoryService } from "./modules/stories/service.ts";
import { storyRoutes } from "./modules/stories/routes.ts";
import { ProjectService } from "./modules/projects/service.ts";
import { projectRoutes } from "./modules/projects/routes.ts";
import { MetricService } from "./modules/metrics/service.ts";
import { metricRoutes } from "./modules/metrics/routes.ts";
import { ReportService } from "./modules/reports/service.ts";
import { reportRoutes } from "./modules/reports/routes.ts";
import { ImpactService, MongoImpactStore } from "./modules/impact/service.ts";
import { MongoTransparencyStore, TransparencyService } from "./modules/transparency/service.ts";
import { CareersService, MongoCareersStore } from "./modules/careers/service.ts";
import { HowWeWorkService, MongoHowWeWorkStore } from "./modules/how-we-work/service.ts";
import { MongoPolicyStore, PolicyDirectory, PolicyService } from "./modules/policies/service.ts";
import { policyRoutes } from "./modules/policies/routes.ts";
import { GetInvolvedDirectory, GetInvolvedService, MongoGetInvolvedStore } from "./modules/get-involved/service.ts";
import { getInvolvedRoutes } from "./modules/get-involved/routes.ts";
import { AnnouncementBarService, MongoAnnouncementBarStore } from "./modules/announcements/service.ts";
import { MongoPopupStore, PopupService } from "./modules/popups/service.ts";
import { MongoStoryStripStore, StoryStripService } from "./modules/highlights/service.ts";
import { healthRoutes } from "./modules/health/routes.ts";
import { AuditService, mongoAuditStore } from "./modules/audit/audit.ts";
import { readCookie } from "./modules/auth/cookies.ts";
import type { ScryptParams } from "./modules/auth/password.ts";
import { can } from "./modules/auth/permissions.ts";
import { mongoAuthStores } from "./modules/auth/repository.ts";
import { authRoutes } from "./modules/auth/routes.ts";
import { AuthService } from "./modules/auth/service.ts";
import type { AuthContext } from "./modules/auth/types.ts";
import { GivebutterClient } from "./modules/donations/givebutter/client.ts";
import { GivebutterProvider } from "./modules/donations/givebutter/provider.ts";
import { ProviderError, type DonationProvider } from "./modules/donations/provider.ts";
import { donationRoutes } from "./modules/donations/routes.ts";
import { R2Storage } from "./modules/media/r2.ts";
import { mongoMemberLeases, teamLock } from "./modules/members/lock.ts";
import { memberRoutes } from "./modules/members/routes.ts";
import { MongoSubmissionStore } from "./modules/submissions/repository.ts";
import { MongoFormDefinitionStore } from "./modules/form-definitions/repository.ts";
import { formDefinitionRoutes } from "./modules/form-definitions/routes.ts";
import { FormDefinitionService } from "./modules/form-definitions/service.ts";
import { FormUploadService, MongoFormUploadStore } from "./modules/forms/uploads.ts";
import { formUploadRoutes } from "./modules/forms/routes.ts";
import { MAX_FILE_BYTES } from "@rbb/content-schema";
import { submissionRoutes } from "./modules/submissions/routes.ts";
import { SubmissionService } from "./modules/submissions/service.ts";
import { AudienceService } from "./modules/audience/service.ts";
import { audienceRoutes } from "./modules/audience/routes.ts";
import { MemberService } from "./modules/members/service.ts";
import { MongoMediaStore } from "./modules/media/repository.ts";
import { createDeliverer, refusingTransport, resendTransport, type EmailTransport, type OutgoingEmail } from "./modules/forms/email.ts";
import { formRoutes } from "./modules/forms/routes.ts";
import { FormService } from "./modules/forms/service.ts";
import { mediaRoutes } from "./modules/media/routes.ts";
import { MediaService } from "./modules/media/service.ts";
import type { ObjectStorage } from "./modules/media/storage.ts";
import { NoDeploymentTrigger, WebhookDeploymentTrigger, type DeploymentTrigger } from "./modules/publishing/deploy.ts";
import { MongoPublishStore } from "./modules/publishing/repository.ts";
import { publishingRoutes } from "./modules/publishing/routes.ts";
import { PublishService } from "./modules/publishing/service.ts";
import { publishLock } from "./modules/publishing/lock.ts";
import { MongoSettingsStore } from "./modules/settings/repository.ts";
import { settingsRoutes } from "./modules/settings/routes.ts";
import { SettingsService } from "./modules/settings/service.ts";
import { GET_INVOLVED_PAGE_IDS, POLICY_IDS, type GetInvolvedPageId, type PolicyId } from "@rbb/content-schema";
import type { AnnouncementBar, Popup, StoryStrip, About, Appeal, Careers, Event, HowWeWork, Impact, Metric, Post, Program, Project, Report, TeamMember, Transparency } from "@rbb/content-schema";
import { MongoContentStore } from "./modules/content/repository.ts";
import { contentRoutes } from "./modules/content/routes.ts";
import { ContentService } from "./modules/content/service.ts";
import { eventCollection } from "./modules/events/service.ts";
import { POST_TYPES, postCollection } from "./modules/posts/service.ts";

/* The API: one Fetch-standard function, `handle(Request) → Response`.
   Built ONCE per runtime instance (src/vercel.ts, src/server.ts) and
   reused by every request it serves.

   Every request:
     1. gets a request id — the caller's X-Request-Id if it is a safe
        token, otherwise a new UUID — returned in X-Request-Id and on
        every log line
     2. is refused early if it declares a body over BODY_LIMIT_BYTES
     3. is routed: 404 unknown path, 405 known path / wrong method,
        CORS preflight answered for allowed origins only
     4. CSRF: a state-changing request (POST, PUT, PATCH, DELETE) must
        carry an Origin on the allow-list — a browser always sends one, so a
        cross-site form or script is refused before anything runs
     5. authentication: for a route that declares `auth`, the session
        cookie is resolved to the full auth context HERE, once — 401 if a
        required session is missing/expired/revoked, 403 if the route's
        `permission` is not the member's
     6. runs its handler; an ApiError becomes its error response, a
        database outage becomes 503, anything else becomes a generic 500
        whose details go only to the log
     7. leaves with security headers, CORS headers (allowed origins only)
        and one structured log line: method, path, status, duration

   An invalid configuration does not crash the app: liveness keeps
   answering, everything else is 503 with a generic message, and the
   problems (variable names only) are logged once at startup. */

export const REQUEST_ID_HEADER = "X-Request-Id";
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface AppOptions {
  env?: Record<string, string | undefined>;
  /* A ready configuration, bypassing the environment (tests). */
  config?: Config;
  /* Overrides the database provider; null means "no database". */
  mongo?: MongoProvider | null;
  /* Where log lines go (default: stdout). */
  write?: (line: string) => void;
  /* Cheaper password hashing for tests; production uses the default. */
  scrypt?: ScryptParams;
  now?: () => Date;
  /* A stand-in donation provider (tests); by default the configured one. */
  donationProvider?: DonationProvider | null;
  /* A stand-in object storage (tests); by default the configured R2. */
  storage?: ObjectStorage | null;
  /* A stand-in deployment trigger (tests); by default from DEPLOY_HOOK_URL. */
  deployTrigger?: DeploymentTrigger;
  /* M18: how form email leaves the server. By default Resend — except
     under NODE_ENV=test, where nothing is ever sent unless a test passes
     its own transport. */
  emailTransport?: EmailTransport;
  /* M18: test mode hands each rendered form email here (tests, local). */
  formsCapture?: (email: OutgoingEmail) => void;
}

/* What the hosting adapter knows about the request beyond the Request
   itself. `clientIp` must come from the platform (socket address, or the
   address the platform's edge recorded) — never from a header the client
   can set. */
export interface RequestInfo {
  clientIp?: string | null;
}

export interface App {
  handle(request: Request, info?: RequestInfo): Promise<Response>;
  readonly config: Config | null;
  readonly log: Logger;
}

export function createApp(options: AppOptions = {}): App {
  const env = options.env ?? process.env;
  let config: Config | null = options.config ?? null;
  let configProblems: string[] = [];
  if (!config) {
    try {
      config = loadConfig(env);
    } catch (error) {
      if (!(error instanceof ConfigError)) throw error;
      configProblems = error.problems;
    }
  }

  const log = createLogger({
    level: config?.logLevel ?? "info",
    base: { service: "rbb-api", env: config?.env ?? env.NODE_ENV ?? "development" },
    includeStacks: config ? config.env !== "production" : false,
    ...(options.write && { write: options.write }),
  });
  if (configProblems.length) log.error("configuration invalid — only liveness will answer", { problems: configProblems });
  else log.info("configuration loaded", { environment: describeEnvironment(env), target: config!.target.kind });
  if (config?.forms.problems.length) log.warn("form configuration problems — the affected forms are off", { problems: config.forms.problems });
  if (config?.auth.secretIsEphemeral && config.env === "development")
    log.warn("AUTH_SECRET is not set — using a per-process secret (development only)");

  const mongo = options.mongo !== undefined ? options.mongo : config?.mongo ? createMongoProvider(config.mongo) : null;

  /* The appeal store — read by M2's internal route even before the rest
     of the configuration exists, as that route always was. */
  const appealStore = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    return new MongoContentStore<Appeal>(await mongo.db(), COLLECTIONS.appeals, config.orgId, { dateField: "record.publishedAt" });
  };

  const auth = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    const audit = new AuditService(mongoAuditStore(db, config.orgId), { orgId: config.orgId, secret: config.auth.secret, log, ...(options.now && { now: options.now }) });
    return new AuthService(mongoAuthStores(db, config.orgId), {
      orgId: config.orgId,
      config: config.auth,
      audit,
      log,
      ...(options.now && { now: options.now }),
      ...(options.scrypt && { scrypt: options.scrypt }),
    });
  };

  /* The donation provider, from server-side configuration only. */
  const configuredProvider =
    options.donationProvider !== undefined
      ? options.donationProvider
      : config?.integrations.givebutter
        ? new GivebutterProvider(new GivebutterClient({ apiKey: config.integrations.givebutter.apiKey }))
        : null;
  const donationProvider = () => {
    if (!configuredProvider) throw new ProviderError("not-configured");
    return configuredProvider;
  };
  /* Givebutter checkouts on appeals and the donation page are verified
     through the same provider — server-side, never from the browser. */
  const verifyCheckouts = checkoutVerifier(donationProvider);

  /* Media storage, from server-side configuration only. */
  const storage =
    options.storage !== undefined
      ? options.storage
      : config?.storage
        ? new R2Storage({
            endpoint: config.storage.endpoint,
            bucket: config.storage.bucket,
            credentials: { accessKeyId: config.storage.accessKeyId, secretAccessKey: config.storage.secretAccessKey },
            publicBaseUrl: config.storage.publicBaseUrl,
            ...(options.now && { now: options.now }),
          })
        : null;

  const media = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    const audit = new AuditService(mongoAuditStore(db, config.orgId), { orgId: config.orgId, secret: config.auth.secret, log, ...(options.now && { now: options.now }) });
    return new MediaService(new MongoMediaStore(db, config.orgId), storage, audit, mongoAuthStores(db, config.orgId).throttle, {
      orgId: config.orgId,
      /* Phase 0: object keys follow the TARGET, not NODE_ENV. */
      env: mediaKeyEnv(config.env, config.target),
      log,
      ...(options.now && { now: options.now }),
      // M16: a media item the website or approved content still needs is not deleted.
      usage: async (mediaId) => (await publishing()).mediaUsage(mediaId),
      lock: lockFor(db),
    });
  };

  const auditFor = (db: Awaited<ReturnType<MongoProvider["db"]>>, cfg: Config) =>
    new AuditService(mongoAuditStore(db, cfg.orgId), { orgId: cfg.orgId, secret: cfg.auth.secret, log, ...(options.now && { now: options.now }) });

  /* M18: the public forms. Contact, Volunteer and Partner submissions are
     stored for owners to read (2026-10-13) and emailed when email is
     configured; other forms stay email-only. */
  const emailTransport = options.emailTransport ?? (config?.env === "test" ? refusingTransport : resendTransport());
  const forms = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new FormService(mongoAuthStores(db, config.orgId).throttle, auditFor(db, config), {
      orgId: config.orgId,
      config: config.forms,
      secret: config.auth.secret,
      transport: emailTransport,
      log,
      ...(options.now && { now: options.now }),
      ...(options.formsCapture && { capture: options.formsCapture }),
      submissions: new MongoSubmissionStore(db, config.orgId),
      definitions: { live: (id: string) => new MongoFormDefinitionStore(db, config.orgId).get(id) },
      uploads: formUploads(db, config),
    });
  };

  /* Career-form attachments: into the media bucket under private/forms/. */
  const formUploads = (db: Awaited<ReturnType<MongoProvider["db"]>>, cfg: Config) =>
    new FormUploadService(new MongoFormUploadStore(db, cfg.orgId), storage, mongoAuthStores(db, cfg.orgId).throttle, { orgId: cfg.orgId, env: cfg.env, secret: cfg.auth.secret, log, ...(options.now && { now: options.now }) });
  const uploadDeps = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    const store = new MongoFormDefinitionStore(db, config.orgId);
    return { uploads: formUploads(db, config), definitions: { live: (id: string) => store.get(id) } };
  };

  /* Admin → Audience: every person across the forms — owners only. */
  const audience = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new AudienceService(new MongoSubmissionStore(db, config.orgId), auditFor(db, config));
  };

  /* The website forms in the admin — owners only, live when saved. */
  const formDefinitions = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new FormDefinitionService(new MongoFormDefinitionStore(db, config.orgId), { careers: new MongoCareersStore(db, config.orgId), publisher: await publishing(), audit: auditFor(db, config), orgId: config.orgId, ...(options.now && { now: options.now }) });
  };

  /* Form submissions in the admin — owners only. */
  const submissions = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    /* Replies go out the forms' way (same sender and mode), only while
       email is on; the visitor's answer goes to the form's RBB inbox. */
    const emailOn = config.forms.mode !== "off" && (Object.keys(config.forms.recipients).length > 0 || Boolean(config.forms.careersRecipient));
    const replyTo = (formId: string) => (formId.startsWith("career-") ? (config.forms.careersRecipient ?? undefined) : config.forms.recipients[formId as keyof typeof config.forms.recipients]);
    const mailer = emailOn ? { deliver: createDeliverer(config.forms, emailTransport, options.formsCapture), replyTo } : null;
    const definitions = new MongoFormDefinitionStore(db, config.orgId);
    const titles = async () => Object.fromEntries((await definitions.list()).map((d) => [d.id, d.title]));
    return new SubmissionService(new MongoSubmissionStore(db, config.orgId), auditFor(db, config), { ...(options.now && { now: options.now }), mailer, storage, titles });
  };

  const members = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new MemberService(mongoAuthStores(db, config.orgId), auditFor(db, config), {
      orgId: config.orgId,
      lock: teamLock(mongoMemberLeases(db, config.orgId), options.now),
      ...(options.now && { now: options.now }),
    });
  };

  const settings = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new SettingsService(new MongoSettingsStore(db, config.orgId), new MongoMediaStore(db, config.orgId), auditFor(db, config), {
      orgId: config.orgId,
      ...(options.now && { now: options.now }),
    });
  };

  /* M15: the publish lock, for the services whose schedule changes must not interleave with a publication. */
  const lockFor = (db: Awaited<ReturnType<MongoProvider["db"]>>) => publishLock(new MongoPublishStore(db, config!.orgId), options.now);
  const deployTrigger = options.deployTrigger ?? (config?.deployHookUrl ? new WebhookDeploymentTrigger(config.deployHookUrl) : new NoDeploymentTrigger());
  const publishing = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new PublishService(
      {
        publish: new MongoPublishStore(db, config.orgId),
        settings: new MongoSettingsStore(db, config.orgId),
        media: new MongoMediaStore(db, config.orgId),
        posts: new MongoContentStore<Post & { title: string }>(db, COLLECTIONS.posts, config.orgId, { types: POST_TYPES }),
        events: new MongoContentStore<Event>(db, COLLECTIONS.events, config.orgId),
        appeals: await appealStore(),
        donationPage: new MongoDonationPageStore(db, config.orgId),
        homepage: new MongoHomepageStore(db, config.orgId),
        about: new MongoAboutStore(db, config.orgId),
        team: teamStore(db),
        programs: programStore(db),
        metrics: metricStore(db),
        reports: reportStore(db),
        impact: new MongoImpactStore(db, config.orgId),
        transparency: new MongoTransparencyStore(db, config.orgId),
        stories: storyStore(db),
        projects: projectStore(db),
        careers: new MongoCareersStore(db, config.orgId),
        forms: new MongoFormDefinitionStore(db, config.orgId),
        howWeWork: new MongoHowWeWorkStore(db, config.orgId),
        policies: Object.fromEntries(POLICY_IDS.map((id) => [id, new MongoPolicyStore(db, config.orgId, id)])),
        getInvolved: Object.fromEntries(GET_INVOLVED_PAGE_IDS.map((id) => [id, new MongoGetInvolvedStore(db, config.orgId, id)])),
        announcementBar: new MongoAnnouncementBarStore(db, config.orgId),
        popup: new MongoPopupStore(db, config.orgId),
        storyStrip: new MongoStoryStripStore(db, config.orgId),
      },
      auditFor(db, config),
      deployTrigger,
      { orgId: config.orgId, log, verifyCheckouts, ...(options.now && { now: options.now }) }
    );
  };

  const posts = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new ContentService(postCollection({ programs: programStore(db) }), new MongoContentStore<Post & { title: string }>(db, COLLECTIONS.posts, config.orgId, { types: POST_TYPES }), new MongoMediaStore(db, config.orgId), auditFor(db, config), {
      orgId: config.orgId,
      ...(options.now && { now: options.now }),
      lock: lockFor(db),
    });
  };
  const events = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new ContentService(eventCollection({ programs: programStore(db) }), new MongoContentStore<Event>(db, COLLECTIONS.events, config.orgId), new MongoMediaStore(db, config.orgId), auditFor(db, config), {
      orgId: config.orgId,
      ...(options.now && { now: options.now }),
      lock: lockFor(db),
    });
  };

  const appeals = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new ContentService(appealCollection(verifyCheckouts), await appealStore(), new MongoMediaStore(db, config.orgId), auditFor(db, config), {
      orgId: config.orgId,
      ...(options.now && { now: options.now }),
      lock: lockFor(db),
    });
  };
  const donationPage = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new DonationPageService(new MongoDonationPageStore(db, config.orgId), new MongoMediaStore(db, config.orgId), auditFor(db, config), verifyCheckouts, {
      orgId: config.orgId,
      ...(options.now && { now: options.now }),
      lock: lockFor(db),
    });
  };

  const teamStore = (db: Awaited<ReturnType<MongoProvider["db"]>>) => new MongoContentStore<TeamMember>(db, COLLECTIONS.teamMembers, config!.orgId, { dateField: "record.order", titleField: "record.name" });
  const programStore = (db: Awaited<ReturnType<MongoProvider["db"]>>) => new MongoContentStore<Program>(db, COLLECTIONS.programs, config!.orgId, { dateField: "record.order" });
  const programs = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new ProgramService(programStore(db), new MongoMediaStore(db, config.orgId), auditFor(db, config), { orgId: config.orgId, ...(options.now && { now: options.now }), lock: lockFor(db) });
  };
  const metricStore = (db: Awaited<ReturnType<MongoProvider["db"]>>) => new MongoContentStore<Metric>(db, COLLECTIONS.metrics, config!.orgId, { dateField: "record.order", titleField: "record.label" });
  const reportStore = (db: Awaited<ReturnType<MongoProvider["db"]>>) => new MongoContentStore<Report>(db, COLLECTIONS.reports, config!.orgId, { dateField: "record.order" });
  const metrics = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new MetricService(metricStore(db), new MongoMediaStore(db, config.orgId), auditFor(db, config), { orgId: config.orgId, ...(options.now && { now: options.now }), lock: lockFor(db) });
  };
  const reports = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new ReportService(reportStore(db), new MongoMediaStore(db, config.orgId), auditFor(db, config), { orgId: config.orgId, ...(options.now && { now: options.now }), lock: lockFor(db) });
  };
  const impact = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new ImpactService(new MongoImpactStore(db, config.orgId), new MongoMediaStore(db, config.orgId), { stories: storyStore(db), programs: programStore(db) }, auditFor(db, config), { orgId: config.orgId, ...(options.now && { now: options.now }), lock: lockFor(db) });
  };
  /* Stories (M12) are posts of type "story": the posts collection, through a store scoped to stories. */
  const storyStore = (db: Awaited<ReturnType<MongoProvider["db"]>>) => new MongoContentStore<Post & { title: string }>(db, COLLECTIONS.posts, config!.orgId, { types: ["story"] });
  const projectStore = (db: Awaited<ReturnType<MongoProvider["db"]>>) => new MongoContentStore<Project>(db, COLLECTIONS.projects, config!.orgId, { dateField: "record.order" });
  const stories = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new StoryService(storyStore(db), new MongoMediaStore(db, config.orgId), { programs: programStore(db), projects: projectStore(db) }, auditFor(db, config), { orgId: config.orgId, ...(options.now && { now: options.now }), lock: lockFor(db) });
  };
  const projects = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new ProjectService(projectStore(db), new MongoMediaStore(db, config.orgId), { programs: programStore(db), stories: storyStore(db) }, auditFor(db, config), { orgId: config.orgId, ...(options.now && { now: options.now }), lock: lockFor(db) });
  };
  const careers = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new CareersService(new MongoCareersStore(db, config.orgId), new MongoMediaStore(db, config.orgId), auditFor(db, config), { orgId: config.orgId, ...(options.now && { now: options.now }), lock: lockFor(db) });
  };
  const howWeWork = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new HowWeWorkService(new MongoHowWeWorkStore(db, config.orgId), new MongoMediaStore(db, config.orgId), auditFor(db, config), { orgId: config.orgId, ...(options.now && { now: options.now }), lock: lockFor(db) });
  };
  const policy = async (id: PolicyId) => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new PolicyService(id, new MongoPolicyStore(db, config.orgId, id), new MongoSettingsStore(db, config.orgId), new MongoMediaStore(db, config.orgId), auditFor(db, config), { orgId: config.orgId, ...(options.now && { now: options.now }), lock: lockFor(db) });
  };
  const policyDirectory = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    const services = Object.fromEntries(await Promise.all(POLICY_IDS.map(async (id) => [id, await policy(id)]))) as Record<PolicyId, PolicyService>;
    return new PolicyDirectory(services, new MongoSettingsStore(db, config.orgId), config.orgId);
  };
  const getInvolvedPage = async (id: GetInvolvedPageId) => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new GetInvolvedService(id, new MongoGetInvolvedStore(db, config.orgId, id), new MongoMediaStore(db, config.orgId), auditFor(db, config), { orgId: config.orgId, ...(options.now && { now: options.now }), lock: lockFor(db) });
  };
  const getInvolvedDirectory = async () => {
    if (!config) throw errors.unavailable("The database is not configured.");
    const services = Object.fromEntries(await Promise.all(GET_INVOLVED_PAGE_IDS.map(async (id) => [id, await getInvolvedPage(id)]))) as Record<GetInvolvedPageId, GetInvolvedService>;
    return new GetInvolvedDirectory(services, config.orgId);
  };
  const announcementBar = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new AnnouncementBarService(new MongoAnnouncementBarStore(db, config.orgId), new MongoMediaStore(db, config.orgId), auditFor(db, config), { orgId: config.orgId, ...(options.now && { now: options.now }), lock: lockFor(db) });
  };
  const popup = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new PopupService(new MongoPopupStore(db, config.orgId), new MongoMediaStore(db, config.orgId), auditFor(db, config), { orgId: config.orgId, ...(options.now && { now: options.now }), lock: lockFor(db) });
  };
  const storyStrip = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new StoryStripService(new MongoStoryStripStore(db, config.orgId), (await appealStore()) as never, new MongoMediaStore(db, config.orgId), auditFor(db, config), { orgId: config.orgId, ...(options.now && { now: options.now }), lock: lockFor(db) });
  };
  const transparency = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new TransparencyService(new MongoTransparencyStore(db, config.orgId), new MongoMediaStore(db, config.orgId), auditFor(db, config), { orgId: config.orgId, ...(options.now && { now: options.now }), lock: lockFor(db) });
  };
  const about = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new AboutService(new MongoAboutStore(db, config.orgId), new MongoMediaStore(db, config.orgId), auditFor(db, config), { orgId: config.orgId, ...(options.now && { now: options.now }), lock: lockFor(db) });
  };
  const team = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new TeamService(teamStore(db), new MongoMediaStore(db, config.orgId), auditFor(db, config), { orgId: config.orgId, ...(options.now && { now: options.now }), lock: lockFor(db) });
  };

  const homepage = async () => {
    if (!config || !mongo) throw errors.unavailable("The database is not configured.");
    const db = await mongo.db();
    return new HomepageService(
      new MongoHomepageStore(db, config.orgId),
      new MongoMediaStore(db, config.orgId),
      {
        posts: new MongoContentStore<Post & { title: string }>(db, COLLECTIONS.posts, config.orgId, { types: POST_TYPES }),
        events: new MongoContentStore<Event>(db, COLLECTIONS.events, config.orgId),
        appeals: await appealStore(),
      },
      auditFor(db, config),
      { orgId: config.orgId, ...(options.now && { now: options.now }), lock: lockFor(db) }
    );
  };

  const routes: Route[] = [
    ...healthRoutes({ configured: config !== null, mongo, target: config?.target.kind ?? null }),
    ...appealRoutes(appealStore),
    ...(config ? authRoutes(auth, config.auth.cookie) : []),
    ...(config ? memberRoutes(members) : []),
    ...(config ? formRoutes(forms, config.cors.web) : []),
    ...(config ? submissionRoutes(submissions) : []),
    ...(config ? formDefinitionRoutes(formDefinitions) : []),
    ...(config ? audienceRoutes(audience) : []),
    ...(config ? formUploadRoutes(uploadDeps, config.cors.web) : []),
    ...(config ? donationRoutes(donationProvider) : []),
    ...(config ? mediaRoutes(media) : []),
    ...(config ? settingsRoutes(settings) : []),
    ...(config ? publishingRoutes(publishing, config.scheduler, config.mongo ? { organization: config.orgId, database: config.mongo.dbName } : null) : []),
    ...(config ? contentRoutes("posts", posts) : []),
    ...(config ? contentRoutes("events", events) : []),
    ...(config ? contentRoutes("appeals", appeals) : []),
    ...(config ? donationPageRoutes(donationPage) : []),
    ...(config ? homepageRoutes(homepage) : []),
    ...(config ? blockPageRoutes<About>("about", about) : []),
    ...(config ? teamRoutes(team) : []),
    ...(config ? programRoutes(programs) : []),
    ...(config ? metricRoutes(metrics) : []),
    ...(config ? reportRoutes(reports) : []),
    ...(config ? blockPageRoutes<Impact>("impact", impact) : []),
    ...(config ? blockPageRoutes<Transparency>("transparency", transparency) : []),
    ...(config ? storyRoutes(stories) : []),
    ...(config ? projectRoutes(projects) : []),
    ...(config ? blockPageRoutes<Careers>("careers", careers) : []),
    ...(config ? blockPageRoutes<HowWeWork>("how-we-work", howWeWork) : []),
    ...(config ? policyRoutes(policyDirectory, policy) : []),
    ...(config ? getInvolvedRoutes(getInvolvedDirectory, getInvolvedPage) : []),
    ...(config ? blockPageRoutes<AnnouncementBar>("announcement-bar", announcementBar) : []),
    ...(config ? blockPageRoutes<Popup>("popup", popup) : []),
    ...(config ? blockPageRoutes<StoryStrip>("story-strip", storyStrip) : []),
  ];
  const router = createRouter(routes);
  const UPLOAD_PATH = /^\/api\/v1\/forms\/[^/]+\/files$/;
  const allowedOrigins = config?.cors.origins ?? [];

  async function respond(request: Request, url: URL, requestId: string, requestLog: Logger, clientIp: string | null): Promise<Response> {
    /* A career form's attachment upload (at most MAX_FILE_BYTES) is the one
       body allowed past the general limit; its route enforces its own. */
    const limit = request.method === "POST" && UPLOAD_PATH.test(url.pathname) ? MAX_FILE_BYTES : BODY_LIMIT_BYTES;
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > limit) throw errors.payloadTooLarge(limit);

    let match;
    try {
      match = router.match(request.method === "OPTIONS" ? "GET" : request.method, url.pathname);
    } catch {
      throw errors.badRequest("The request path is malformed.");
    }

    /* Without a valid configuration only the routes that need none are
       registered (liveness, M2's internal appeal read). Any other path is
       turned away as unavailable — never a 404 "route not found" for a
       route that exists once the API is configured (which reads as a
       routing fault, and hides the real one: the configuration). */
    const notFound = () => (config ? errors.notFound("route") : errors.unavailable());

    if (request.method === "OPTIONS") {
      if (match.kind === "not-found") throw notFound();
      const methods = match.kind === "route" ? [match.route.method] : match.allowed;
      const origin = request.headers.get("origin");
      if (!request.headers.get("access-control-request-method"))
        return new Response(null, { status: 204, headers: { Allow: [...methods, "OPTIONS"].join(", ") } });
      if (!isAllowedOrigin(origin, allowedOrigins)) throw errors.forbidden("This origin is not allowed.");
      return new Response(null, { status: 204, headers: preflightHeaders(origin, [...methods, "OPTIONS"]) });
    }

    if (match.kind === "not-found") throw notFound();
    if (match.kind === "method-not-allowed") throw errors.methodNotAllowed(match.allowed);
    if (!config && !match.route.live) throw errors.unavailable();

    /* CSRF. Cookies authenticate, so any state change must prove it comes
       from a page this deployment trusts. Browsers always send Origin on
       these methods and scripts cannot forge it. (Server-to-server callers
       such as future webhooks will need a route-level exception.) */
    const origin = request.headers.get("origin");
    if (!SAFE_METHODS.has(request.method) && !isAllowedOrigin(origin, allowedOrigins))
      throw errors.forbidden("This origin is not allowed to make changes.");

    let session: AuthContext | null = null;
    if (match.route.auth && config) {
      const token = readCookie(request.headers.get("cookie"), config.auth.cookie.name);
      if (token) session = await (await auth()).resolveSession(token);
      if (match.route.auth === "required" && !session) throw errors.unauthenticated();
    }
    if (match.route.permission && !can(session, match.route.permission))
      throw session ? errors.forbidden("You do not have permission to do this.") : errors.unauthenticated();

    return match.route.handler({ request, url, params: match.params, requestId, log: requestLog, clientIp, auth: session });
  }

  async function handle(request: Request, info: RequestInfo = {}): Promise<Response> {
    const started = performance.now();
    const incoming = request.headers.get(REQUEST_ID_HEADER);
    const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
    const url = new URL(request.url);
    const requestLog = log.child({ requestId });

    let response: Response;
    try {
      response = await respond(request, url, requestId, requestLog, info.clientIp ?? null);
    } catch (error) {
      let apiError: ApiError;
      if (error instanceof ApiError) apiError = error;
      else if (isDatabaseUnavailable(error)) apiError = errors.unavailable("The database is unavailable.", error);
      else apiError = errors.internal(error);
      if (apiError.status >= 500) requestLog.error("request failed", { code: apiError.code, error: apiError.cause ?? apiError });
      response = errorResponse(apiError, requestId);
    }

    for (const [name, value] of Object.entries(SECURITY_HEADERS))
      if (!response.headers.has(name)) response.headers.set(name, value);
    for (const [name, value] of Object.entries(corsHeaders(request.headers.get("origin"), allowedOrigins)))
      if (!response.headers.has(name)) response.headers.set(name, value);
    response.headers.set(REQUEST_ID_HEADER, requestId);

    const fields = {
      method: request.method,
      /* The path only: a query string can carry personal data. */
      path: url.pathname,
      status: response.status,
      durationMs: Math.round(performance.now() - started),
    };
    if (response.status >= 500) requestLog.warn("request", fields);
    else requestLog.info("request", fields);
    return response;
  }

  return { handle, config, log };
}
