import { z } from "zod";
import { IsoDateTime, MediaId, OrgId } from "../common/primitives.ts";
import { FocalPoint, MIME_TYPES } from "../media/media.ts";
import { SiteSettings } from "../settings/siteSettings.ts";
import { BLOG_CATEGORY_IDS, Post, STORY_CATEGORY_IDS } from "../posts/post.ts";
import { Event } from "../events/event.ts";
import { Appeal, GeneralDonationPage } from "../appeals/appeal.ts";
import { Homepage, homepageMediaIds, homepageReferences } from "../homepage/homepage.ts";
import { About, aboutMediaIds } from "../about/about.ts";
import { TeamMember } from "../team/member.ts";
import { Program } from "../programs/program.ts";
import { Metric } from "../impact/metric.ts";
import { Impact, impactMediaIds, impactReferences } from "../impact/impact.ts";
import { Transparency } from "../transparency/transparency.ts";
import { Report } from "../transparency/report.ts";
import { Project, projectMediaIds } from "../projects/project.ts";
import { Careers } from "../careers/careers.ts";
import { HowWeWork } from "../howWeWork/howWeWork.ts";
import { FormDefinition } from "../forms/formDefinition.ts";
import { POLICY_IDS, Policy, policyApprovalProblems } from "../policies/policy.ts";
import { GET_INVOLVED_PAGE_IDS, GetInvolvedPage, getInvolvedApprovalProblems } from "../getInvolved/getInvolved.ts";
import { AnnouncementBar, Popup, StoryStrip, announcementBarApprovalProblems, popupCmsProblems, storyStripApprovalProblems } from "../engagement/engagement.ts";

/* The PUBLISHED SNAPSHOT — the only thing the public site reads from the
   CMS. The API builds one when an owner publishes, stores it immutably
   under an increasing `version`, and serves the active one from
   GET /api/v1/public/snapshot; the web's build fetches it once and
   pre-renders from it.

   Public by construction: every object is strict, so nothing that is not
   listed here — a user, a session, an audit entry, a storage key, a
   draft — can travel inside it. It holds:

     settings   the organization's SiteSettings, as published
     media      the media the published records reference, and only those
                (id → public URL and the facts needed to draw it)
     content    published content collections, one key per collection the
                ORGANIZATION MANAGES IN THE CMS (it has created at least one
                record of that kind). A missing key means "not managed here
                yet" — the website keeps its own source content for it; a
                present key, even empty, means the CMS is the source:
                  news    Post records of type "news"
                  blogs   Post records of type "blog"
                  events  Event records
                  appeals Appeal records (emergency, campaign and special appeals)
                Only PUBLISHED records, as the contract shapes them.
                  generalDonation  the GeneralDonationPage — present only
                                   while the organization's page is
                                   PUBLISHED; absent, the website keeps
                                   its own general donation page
                  homepage         the Homepage — present only while the
                                   organization's homepage is PUBLISHED,
                                   holding its ENABLED blocks only; absent,
                                   the website keeps its own homepage. Its
                                   post/event/appeal references must be
                                   published records in this snapshot
                  about            the About page — as the homepage: only
                                   while PUBLISHED, enabled blocks only
                  team             TeamMember records — a collection, like
                                   news: present once the organization has
                                   created any team member; published only
                  programs         Program records, in order — present once
                                   the organization has PUBLISHED at least
                                   one program (other records point at
                                   programs, so an empty set would break
                                   them); published only
                  metrics          Metric records (the headline figures),
                                   in order — like programs: present once
                                   at least one is PUBLISHED. Every `stats`
                                   block (homepage, Impact page) must then
                                   name published metrics
                  impact           the Impact page — as the About page:
                                   only while PUBLISHED, enabled blocks
                                   only
                  transparency     the Transparency record — only while
                                   PUBLISHED; absent, the website keeps its
                                   own transparency content
                  reports          Report records (transparency documents),
                                   in order — present once at least one is
                                   PUBLISHED
                  stories          Post records of type "story" (M12),
                                   newest first — present once at least
                                   one story is PUBLISHED (the homepage,
                                   /impact and other stories point at
                                   stories). Their related stories, project
                                   and program must be published too
                  careers          the Careers page (M13) — only while it
                                   is PUBLISHED; absent, the website keeps
                                   its own Careers page
                  howWeWork        the How We Work page (#7) — only while
                                   it is PUBLISHED; absent, the website
                                   keeps its own
                  projects         Project records, in order — present once
                                   at least one is PUBLISHED (stories and
                                   program pages point at projects); each
                                   names a published program
                  policies         Policy records (M19: privacy, terms,
                                   donation), in that order — present once
                                   at least one is PUBLISHED, and holding
                                   the published ones only; a policy not
                                   here keeps the website's own record.
                                   Each has both dates and a section, and
                                   its contact is a method in `settings`
                  getInvolved      the Get Involved pages (M20: hub,
                                   volunteer, fellowship, partner, travel),
                                   in that order — present once at least
                                   one is PUBLISHED, holding the published
                                   ones only; a page not here keeps the
                                   website's own words
                  announcementBar  the announcement bar's messages (M21) —
                                   only while the bar is PUBLISHED; absent,
                                   the website keeps its own messages.
                                   Whether it shows, and its interval, are
                                   `settings.engagement.announcementBar`
                  popup            the site popup (M22) — only while it is
                                   PUBLISHED; absent, the website keeps its
                                   own popup. Whether it shows is
                                   `settings.engagement.popup`
                  storyStrip       Highlights (M23): which appeals the story
                                   circles show, in order — only while
                                   PUBLISHED; each a published appeal of
                                   this snapshot. Absent, the website keeps
                                   its rule (highlighted appeals, newest
                                   first). On/off: `settings.engagement
                                   .storyStrip`

   `version` is the publish counter, not a timestamp: a higher version is
   always a later publish. */

export const SNAPSHOT_SCHEMA_VERSION = 1;

/* Public media URLs are https — except a local development API, whose
   storage stand-in is plain http on this machine. */
const isPublicUrl = (value: string) => {
  try {
    const url = new URL(value);
    if (url.username || url.password) return false;
    return url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname));
  } catch {
    return false;
  }
};

export const PublishedMedia = z.strictObject({
  id: MediaId,
  url: z.string().max(2048).refine(isPublicUrl, "must be a public https:// URL"),
  mimeType: z.enum(MIME_TYPES),
  width: z.int().positive().optional(),
  height: z.int().positive().optional(),
  alt: z.string().max(300),
  /* Milestone 2: where to keep the image in frame, and its caption — only
     when the library record has them (media/media.ts FocalPoint). */
  focal: FocalPoint.optional(),
  caption: z.string().max(1000).optional(),
});
export type PublishedMedia = z.infer<typeof PublishedMedia>;

/* Every media id a SiteSettings record points at. */
export const settingsMediaIds = (settings: SiteSettings): string[] =>
  [settings.branding?.logoId, settings.branding?.faviconId, settings.seo.ogImageId].filter((id): id is string => Boolean(id));

/* Every media id a post or an event points at. */
export const recordMediaIds = (record: { imageId?: string; galleryIds?: string[]; seo?: { ogImageId?: string } }): string[] =>
  [record.imageId, ...(record.galleryIds ?? []), record.seo?.ogImageId].filter((id): id is string => Boolean(id));

/* Every media id a page's section blocks point at. */
export const sectionMediaIds = (sections: { data: object }[]): string[] =>
  sections.map((s) => (s.data as { imageId?: string }).imageId).filter((id): id is string => Boolean(id));

/* Every media id an appeal points at. */
export const appealMediaIds = (appeal: Appeal): string[] =>
  [appeal.imageId, appeal.highlight?.imageId, appeal.seo?.ogImageId, ...sectionMediaIds(appeal.sections)].filter((id): id is string => Boolean(id));

/* Every media id the general donation page points at. */
export const donationPageMediaIds = (page: GeneralDonationPage): string[] =>
  [page.hero.imageId, page.seo?.ogImageId, ...sectionMediaIds(page.sections)].filter((id): id is string => Boolean(id));

export const SnapshotContent = z.strictObject({
  news: z.array(Post).optional(),
  blogs: z.array(Post).optional(),
  events: z.array(Event).optional(),
  appeals: z.array(Appeal).optional(),
  generalDonation: GeneralDonationPage.optional(),
  homepage: Homepage.optional(),
  about: About.optional(),
  team: z.array(TeamMember).optional(),
  programs: z.array(Program).min(1).optional(),
  metrics: z.array(Metric).min(1).optional(),
  impact: Impact.optional(),
  transparency: Transparency.optional(),
  reports: z.array(Report).min(1).optional(),
  stories: z.array(Post).min(1).optional(),
  projects: z.array(Project).min(1).optional(),
  careers: Careers.optional(),
  howWeWork: HowWeWork.optional(),
  /* The website forms as saved in the admin (live when saved). */
  forms: z.array(FormDefinition).max(60).optional(),
  policies: z.array(Policy).min(1).max(POLICY_IDS.length).optional(),
  getInvolved: z.array(GetInvolvedPage).min(1).max(GET_INVOLVED_PAGE_IDS.length).optional(),
  announcementBar: AnnouncementBar.optional(),
  popup: Popup.optional(),
  storyStrip: StoryStrip.optional(),
});
export type SnapshotContent = z.infer<typeof SnapshotContent>;

/* Every media id anything in a snapshot points at. */
export const snapshotMediaIds = (settings: SiteSettings, content: SnapshotContent): string[] => [
  ...new Set([
    ...settingsMediaIds(settings),
    ...[...(content.news ?? []), ...(content.blogs ?? []), ...(content.events ?? []), ...(content.stories ?? [])].flatMap(recordMediaIds),
    ...(content.projects ?? []).flatMap(projectMediaIds),
    ...(content.appeals ?? []).flatMap(appealMediaIds),
    ...(content.generalDonation ? donationPageMediaIds(content.generalDonation) : []),
    ...(content.homepage ? homepageMediaIds(content.homepage) : []),
    ...(content.about ? aboutMediaIds(content.about) : []),
    ...(content.team ?? []).map((m) => m.imageId).filter((id): id is string => Boolean(id)),
    ...(content.programs ?? []).map((p) => p.seo?.ogImageId).filter((id): id is string => Boolean(id)),
    ...(content.impact ? impactMediaIds(content.impact) : []),
    ...(content.popup ? [content.popup.imageId] : []),
  ]),
];

const POST_TYPE_OF = { news: "news", blogs: "blog" } as const;

export const PublishedSnapshot = z
  .strictObject({
    version: z.int().positive(),
    schemaVersion: z.literal(SNAPSHOT_SCHEMA_VERSION),
    generatedAt: IsoDateTime,
    organization: z.strictObject({ id: OrgId }),
    settings: SiteSettings,
    media: z.record(MediaId, PublishedMedia),
    content: SnapshotContent,
  })
  .superRefine((snapshot, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: "custom", path, message });
    if (snapshot.settings.orgId !== snapshot.organization.id) issue(["settings", "orgId"], "must be the snapshot's organization");
    if (snapshot.settings.status !== "published") issue(["settings", "status"], "a snapshot holds published settings only");
    if (snapshot.settings.releaseMarker !== undefined) issue(["settings", "releaseMarker"], "is internal and never published");
    if (snapshot.settings.countries !== undefined) issue(["settings", "countries"], "is internal (the admin's country selection) and never published");
    const referenced = new Set(snapshotMediaIds(snapshot.settings, snapshot.content));

    /* Content: published, this organization's, nothing internal, the
       right type per collection, one record per id and per address. */
    const ids = new Set<string>();
    const postIds = new Set([...(snapshot.content.news ?? []), ...(snapshot.content.blogs ?? [])].map((p) => p.id));
    for (const key of ["news", "blogs", "events"] as const) {
      const slugs = new Set<string>();
      (snapshot.content[key] ?? []).forEach((record, i) => {
        const at = ["content", key, i];
        if (record.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
        if (record.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
        if (record.releaseMarker !== undefined) issue([...at, "releaseMarker"], "is internal and never published");
        if (key !== "events" && (record as Post).type !== POST_TYPE_OF[key]) issue([...at, "type"], `must be "${POST_TYPE_OF[key]}" in ${key}`);
        if (ids.has(`${key === "events" ? "event" : "post"}:${record.id}`)) issue([...at, "id"], "appears twice");
        ids.add(`${key === "events" ? "event" : "post"}:${record.id}`);
        if (slugs.has(record.slug)) issue([...at, "slug"], "is already the address of another record in this collection");
        slugs.add(record.slug);
        if (key !== "events")
          for (const related of (record as Post).relatedPostIds ?? []) if (!postIds.has(related)) issue([...at, "relatedPostIds"], "refers to a post that is not published");
        /* Milestone 5: quotes and impact are a story's; news and blog posts carry neither. */
        if (key !== "events") for (const field of ["quotes", "impact"] as const) if ((record as Post)[field] !== undefined) issue([...at, field], "only a story has it");
        /* Milestone 4: a blog post's category, when it has one, is one of
           the blog categories. */
        const category = key === "blogs" ? (record as Post).category : undefined;
        if (category !== undefined && !(BLOG_CATEGORY_IDS as readonly string[]).includes(category)) issue([...at, "category"], `must be one of ${BLOG_CATEGORY_IDS.join(", ")}`);
      });
    }
    /* Appeals: the same rules, in their own address space. */
    const appealSlugs = new Set<string>();
    const appealIds = new Set<string>();
    (snapshot.content.appeals ?? []).forEach((record, i) => {
      const at = ["content", "appeals", i];
      if (record.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
      if (record.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
      if (record.releaseMarker !== undefined) issue([...at, "releaseMarker"], "is internal and never published");
      /* Milestone 7: nor inside a section (a FAQ item may carry one in the contract). */
      if (JSON.stringify(record.sections).includes('"releaseMarker"')) issue([...at, "sections"], "release markers are internal and never published");
      if (appealIds.has(record.id)) issue([...at, "id"], "appears twice");
      appealIds.add(record.id);
      if (appealSlugs.has(record.slug)) issue([...at, "slug"], "is already the address of another record in this collection");
      appealSlugs.add(record.slug);
    });
    const page = snapshot.content.generalDonation;
    if (page) {
      if (page.status !== "published") issue(["content", "generalDonation", "status"], "a snapshot holds published records only");
      if (page.orgId !== snapshot.organization.id) issue(["content", "generalDonation", "orgId"], "must be the snapshot's organization");
      if (page.releaseMarker !== undefined) issue(["content", "generalDonation", "releaseMarker"], "is internal and never published");
      if (JSON.stringify(page.sections).includes('"releaseMarker"')) issue(["content", "generalDonation", "sections"], "release markers are internal and never published");
    }
    const home = snapshot.content.homepage;
    if (home) {
      const at = ["content", "homepage"];
      if (home.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
      if (home.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
      if (JSON.stringify(home).includes('"releaseMarker"')) issue(at, "release markers are internal and never published");
      home.sections.forEach((section, i) => {
        if (!section.enabled) issue([...at, "sections", i, "enabled"], "a disabled block is left out of the published homepage");
      });
      // References resolve to records published in this same snapshot.
      const refs = homepageReferences(home.sections);
      const published = {
        posts: new Set([...(snapshot.content.news ?? []), ...(snapshot.content.blogs ?? [])].map((p) => p.id)),
        events: new Set((snapshot.content.events ?? []).map((e) => e.id)),
        appeals: new Set((snapshot.content.appeals ?? []).map((a) => a.id)),
      };
      for (const kind of ["posts", "events", "appeals"] as const)
        for (const id of refs[kind]) if (!published[kind].has(id)) issue([...at, "sections"], `refers to ${kind.slice(0, -1)} "${id}", which is not published`);
    }
    const about = snapshot.content.about;
    if (about) {
      const at = ["content", "about"];
      if (about.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
      if (about.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
      if (JSON.stringify(about).includes('"releaseMarker"')) issue(at, "release markers are internal and never published");
      about.sections.forEach((section, i) => {
        if (!section.enabled) issue([...at, "sections", i, "enabled"], "a disabled block is left out of the published About page");
      });
    }
    const teamIds = new Set<string>();
    const teamSlugs = new Set<string>();
    (snapshot.content.team ?? []).forEach((member, i) => {
      const at = ["content", "team", i];
      if (member.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
      if (member.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
      if (member.releaseMarker !== undefined) issue([...at, "releaseMarker"], "is internal and never published");
      if (teamIds.has(member.id)) issue([...at, "id"], "appears twice");
      teamIds.add(member.id);
      if (teamSlugs.has(member.slug)) issue([...at, "slug"], "is already the address of another team member");
      teamSlugs.add(member.slug);
      // A person's photograph is described, always (the team page and profile draw it with its alt text).
      if (member.imageId && snapshot.media[member.imageId] && !snapshot.media[member.imageId]!.alt.trim()) issue([...at, "imageId"], "the photograph has no alt text — describe it in the media library");
    });
    const programs = snapshot.content.programs;
    if (programs) {
      const slugs = new Set<string>();
      const ids = new Set<string>();
      programs.forEach((program, i) => {
        const at = ["content", "programs", i];
        if (program.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
        if (program.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
        if (program.releaseMarker !== undefined) issue([...at, "releaseMarker"], "is internal and never published");
        if (ids.has(program.id)) issue([...at, "id"], "appears twice");
        ids.add(program.id);
        if (slugs.has(program.slug)) issue([...at, "slug"], "is already the address of another program");
        slugs.add(program.slug);
      });
      // Records the CMS publishes that name a program must name a published one.
      const check = (programId: string | null | undefined, at: (string | number)[]) => {
        if (programId && !slugs.has(programId)) issue(at, `refers to program "${programId}", which is not published`);
      };
      for (const key of ["news", "blogs", "stories"] as const) (snapshot.content[key] ?? []).forEach((p, i) => check(p.programId, ["content", key, i, "programId"]));
      (snapshot.content.events ?? []).forEach((e, i) => check(e.programId, ["content", "events", i, "programId"]));
      (snapshot.content.homepage?.sections ?? []).forEach((s, i) => {
        if (s.type === "timeline") s.data.items.forEach((item, j) => check(item.programId, ["content", "homepage", "sections", i, "data", "items", j, "programId"]));
      });
    }
    /* The ordered collections the CMS publishes once one record is
       published: published, this organization's, nothing internal, one
       record per id and per slug. */
    const ordered = (key: "metrics" | "reports", noun: string) => {
      const list = snapshot.content[key];
      if (!list) return null;
      const slugs = new Set<string>();
      const ids = new Set<string>();
      list.forEach((record, i) => {
        const at = ["content", key, i];
        if (record.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
        if (record.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
        if (record.releaseMarker !== undefined) issue([...at, "releaseMarker"], "is internal and never published");
        if (ids.has(record.id)) issue([...at, "id"], "appears twice");
        ids.add(record.id);
        if (slugs.has(record.slug)) issue([...at, "slug"], `is already the key of another ${noun}`);
        slugs.add(record.slug);
      });
      return slugs;
    };
    const metricSlugs = ordered("metrics", "metric");
    ordered("reports", "document");

    /* Projects (M12): ordered, like programs; each in a published program
       once the CMS manages programs, and its photograph described. */
    const projectSlugs = snapshot.content.projects ? new Set<string>() : null;
    const programSlugsOf = snapshot.content.programs && new Set(snapshot.content.programs.map((p) => p.slug));
    const described = (id: string | undefined, at: (string | number)[], what: string) => {
      if (id && snapshot.media[id] && !snapshot.media[id]!.alt.trim()) issue(at, `the ${what} has no alt text — describe it in the media library`);
    };
    const projectIds = new Set<string>();
    (snapshot.content.projects ?? []).forEach((p, i) => {
      const at = ["content", "projects", i];
      if (p.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
      if (p.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
      if (p.releaseMarker !== undefined) issue([...at, "releaseMarker"], "is internal and never published");
      if (projectIds.has(p.id)) issue([...at, "id"], "appears twice");
      projectIds.add(p.id);
      if (projectSlugs!.has(p.slug)) issue([...at, "slug"], "is already the address of another project");
      projectSlugs!.add(p.slug);
      if (programSlugsOf && !programSlugsOf.has(p.programId)) issue([...at, "programId"], `refers to program "${p.programId}", which is not published`);
      described(p.imageId, [...at, "imageId"], "photograph");
    });

    /* Stories (M12): posts of type "story", in their own address space;
       one featured at most; every story they relate to, and their project,
       published in this snapshot. */
    const stories = snapshot.content.stories;
    const storyIds = new Set((stories ?? []).map((s) => s.id));
    if (stories) {
      const slugs = new Set<string>();
      const featured = stories.filter((s) => s.featured);
      if (featured.length > 1) issue(["content", "stories"], `${featured.length} stories are featured; one at most`);
      stories.forEach((s, i) => {
        const at = ["content", "stories", i];
        if (s.type !== "story") issue([...at, "type"], 'must be "story" in stories');
        if (s.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
        if (s.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
        if (s.releaseMarker !== undefined) issue([...at, "releaseMarker"], "is internal and never published");
        if (ids.has(`post:${s.id}`)) issue([...at, "id"], "appears twice");
        ids.add(`post:${s.id}`);
        if (slugs.has(s.slug)) issue([...at, "slug"], "is already the address of another story");
        slugs.add(s.slug);
        if (!s.category || !(STORY_CATEGORY_IDS as readonly string[]).includes(s.category)) issue([...at, "category"], `must be one of ${STORY_CATEGORY_IDS.join(", ")}`);
        for (const related of s.relatedPostIds ?? []) if (related === s.id || !storyIds.has(related)) issue([...at, "relatedPostIds"], related === s.id ? "names the story itself" : "refers to a story that is not published");
        if (projectSlugs && s.projectId && !projectSlugs.has(s.projectId)) issue([...at, "projectId"], `refers to project "${s.projectId}", which is not published`);
        described(s.imageId, [...at, "imageId"], "image");
        (s.galleryIds ?? []).forEach((id, j) => described(id, [...at, "galleryIds", j], "gallery image"));
      });
      for (const id of (snapshot.content.impact && impactReferences(snapshot.content.impact.sections).stories) || []) if (!storyIds.has(id)) issue(["content", "impact", "sections"], `refers to story "${id}", which is not published`);
      /* Milestone 6: a project's story, once the CMS's stories are the
         site's, is one published here (without them it names the website's
         own story, which the website build checks). */
      (snapshot.content.projects ?? []).forEach((p, i) => {
        if (p.storyId && !storyIds.has(p.storyId)) issue(["content", "projects", i, "storyId"], `refers to story "${p.storyId}", which is not published`);
      });
    }

    const impact = snapshot.content.impact;
    if (impact) {
      const at = ["content", "impact"];
      if (impact.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
      if (impact.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
      if (JSON.stringify(impact).includes('"releaseMarker"')) issue(at, "release markers are internal and never published");
      impact.sections.forEach((section, i) => {
        if (!section.enabled) issue([...at, "sections", i, "enabled"], "a disabled block is left out of the published Impact page");
      });
      // A program it names must be published, once the CMS manages programs.
      const programSlugs = snapshot.content.programs && new Set(snapshot.content.programs.map((p) => p.slug));
      if (programSlugs) for (const slug of impactReferences(impact.sections).programs) if (!programSlugs.has(slug)) issue([...at, "sections"], `refers to program "${slug}", which is not published`);
    }
    const careers = snapshot.content.careers;
    if (careers) {
      const at = ["content", "careers"];
      if (careers.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
      if (careers.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
      if (careers.releaseMarker !== undefined) issue([...at, "releaseMarker"], "is internal and never published");
    }
    const forms = snapshot.content.forms;
    if (forms) {
      const ids = new Set<string>();
      forms.forEach((f, i) => {
        if (f.orgId !== snapshot.organization.id) issue(["content", "forms", i, "orgId"], "must be the snapshot's organization");
        if (ids.has(f.id)) issue(["content", "forms", i, "id"], `form "${f.id}" twice`);
        ids.add(f.id);
      });
    }
    const howWeWork = snapshot.content.howWeWork;
    if (howWeWork) {
      const at = ["content", "howWeWork"];
      if (howWeWork.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
      if (howWeWork.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
      if (howWeWork.releaseMarker !== undefined) issue([...at, "releaseMarker"], "is internal and never published");
    }
    /* Policies: published, complete, in the fixed order, each once; a
       contact a policy names is one of the published settings' methods. */
    const policies = snapshot.content.policies;
    if (policies) {
      const methods = new Set(snapshot.settings.contact.methods.map((m) => m.id));
      const order = policies.map((p) => POLICY_IDS.indexOf(p.id));
      if (order.some((n, i) => i > 0 && n <= order[i - 1]!)) issue(["content", "policies"], `must list each policy once, in the order ${POLICY_IDS.join(", ")}`);
      policies.forEach((policy, i) => {
        const at = ["content", "policies", i];
        if (policy.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
        if (policy.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
        for (const p of policyApprovalProblems(policy)) issue([...at, p.path], p.message);
        if (policy.contactReference && !methods.has(policy.contactReference)) issue([...at, "contactReference"], `names contact method "${policy.contactReference}", which is not in the published settings`);
      });
    }
    /* Get Involved: published, complete, in the fixed order, each once. */
    const getInvolved = snapshot.content.getInvolved;
    if (getInvolved) {
      const order = getInvolved.map((p) => GET_INVOLVED_PAGE_IDS.indexOf(p.id));
      if (order.some((n, i) => i > 0 && n <= order[i - 1]!)) issue(["content", "getInvolved"], `must list each page once, in the order ${GET_INVOLVED_PAGE_IDS.join(", ")}`);
      getInvolved.forEach((page, i) => {
        const at = ["content", "getInvolved", i];
        if (page.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
        if (page.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
        for (const p of getInvolvedApprovalProblems(page)) issue([...at, p.path], p.message);
      });
    }
    const bar = snapshot.content.announcementBar;
    if (bar) {
      const at = ["content", "announcementBar"];
      if (bar.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
      if (bar.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
      for (const p of announcementBarApprovalProblems(bar)) issue([...at, p.path], p.message);
    }
    const popup = snapshot.content.popup;
    if (popup) {
      const at = ["content", "popup"];
      if (popup.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
      if (popup.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
      for (const p of popupCmsProblems(popup)) issue([...at, ...p.path.split(".")], p.message);
      if (snapshot.media[popup.imageId] && !snapshot.media[popup.imageId]!.alt.trim()) issue([...at, "imageId"], "the photograph has no alt text — describe it in the media library");
    }
    const strip = snapshot.content.storyStrip;
    if (strip) {
      const at = ["content", "storyStrip"];
      if (strip.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
      if (strip.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
      for (const p of storyStripApprovalProblems(strip)) issue([...at, p.path], p.message);
      const published = new Set((snapshot.content.appeals ?? []).map((a) => a.id));
      strip.appealIds.forEach((id, i) => {
        if (!published.has(id)) issue([...at, "appealIds", i], `refers to appeal "${id}", which is not published`);
      });
    }
    const transparency = snapshot.content.transparency;
    if (transparency) {
      const at = ["content", "transparency"];
      if (transparency.status !== "published") issue([...at, "status"], "a snapshot holds published records only");
      if (transparency.orgId !== snapshot.organization.id) issue([...at, "orgId"], "must be the snapshot's organization");
      if (transparency.releaseMarker !== undefined) issue([...at, "releaseMarker"], "is internal and never published");
    }
    /* Figures are named, never restated: once the CMS manages them, every
       `stats` block (homepage, Impact page) names published metrics. */
    if (metricSlugs) {
      const stats = (sections: { type: string; data: unknown }[] | undefined, where: string) =>
        (sections ?? []).forEach((s, i) => {
          if (s.type !== "stats") return;
          for (const slug of (s.data as { metricIds: string[] }).metricIds) if (!metricSlugs.has(slug)) issue(["content", where, "sections", i, "data", "metricIds"], `refers to figure "${slug}", which is not published`);
        });
      stats(snapshot.content.homepage?.sections, "homepage");
      stats(snapshot.content.impact?.sections, "impact");
    }
    for (const id of referenced) if (!snapshot.media[id]) issue(["media", id], "is referenced by a published record but missing from the snapshot");
    for (const [key, media] of Object.entries(snapshot.media)) {
      if (media.id !== key) issue(["media", key, "id"], "must equal its key");
      if (!referenced.has(key)) issue(["media", key], "is not referenced by any published record");
    }
  });
export type PublishedSnapshot = z.infer<typeof PublishedSnapshot>;
