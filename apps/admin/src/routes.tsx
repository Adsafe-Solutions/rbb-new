import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { AuthView } from "./api";
import { SHOW_DESIGN_SYSTEM } from "./config";
import type { BreadcrumbItem } from "./design-system";
import { DashboardPage } from "./pages/DashboardPage";
import { NotFoundPage } from "./pages/NotFoundPage";

/* The signed-in routes. A path not listed here renders NotFoundPage inside
   the shell. Content modules add their routes here as they are built. */

export interface PageProps {
  view: AuthView;
  /* Values of the route's :parameters ("/posts/:id" → { id }). */
  params: Record<string, string>;
}
type PageComponent = ComponentType<PageProps> | LazyExoticComponent<ComponentType<PageProps>>;

export interface RouteDefinition {
  path: string;
  title: string;
  breadcrumb: BreadcrumbItem[];
  component: PageComponent;
  /* Members without this permission get "no access" instead of the page.
     For navigation only — the API authorizes every request itself. */
  permission?: string;
}

/* Development-only: when SHOW_DESIGN_SYSTEM is false at build time, the
   import below is dead code and the preview is not in the bundle. */
const MediaLibraryPage = lazy(() => import("./pages/media/MediaLibraryPage"));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));
const PostsPage = lazy(() => import("./pages/posts/PostsPage"));
const PostEditorPage = lazy(() => import("./pages/posts/PostEditorPage"));
const EventsPage = lazy(() => import("./pages/events/EventsPage"));
const EventEditorPage = lazy(() => import("./pages/events/EventEditorPage"));
const AppealsPage = lazy(() => import("./pages/appeals/AppealsPage"));
const AppealEditorPage = lazy(() => import("./pages/appeals/AppealEditorPage"));
const DonationPageEditor = lazy(() => import("./pages/donation/DonationPageEditor"));
const HomepagePage = lazy(() => import("./pages/homepage/HomepagePage"));
const AboutPage = lazy(() => import("./pages/about/AboutPage"));
const TeamPage = lazy(() => import("./pages/team/TeamPage"));
const TeamEditorPage = lazy(() => import("./pages/team/TeamEditorPage"));
const ProgramsPage = lazy(() => import("./pages/programs/ProgramsPage"));
const ProgramEditorPage = lazy(() => import("./pages/programs/ProgramEditorPage"));
const ImpactPage = lazy(() => import("./pages/impact/ImpactPage"));
const ProjectsPage = lazy(() => import("./pages/projects/ProjectsPage"));
const ProjectEditorPage = lazy(() => import("./pages/projects/ProjectEditorPage"));
const StoriesPage = lazy(() => import("./pages/stories/StoriesPage"));
const CareersPage = lazy(() => import("./pages/careers/CareersPage"));
const HowWeWorkPage = lazy(() => import("./pages/howWeWork/HowWeWorkPage"));
const PoliciesPage = lazy(() => import("./pages/policies/PoliciesPage"));
const PolicyEditorPage = lazy(() => import("./pages/policies/PolicyEditorPage"));
const GetInvolvedPage = lazy(() => import("./pages/getInvolved/GetInvolvedPage"));
const GetInvolvedEditorPage = lazy(() => import("./pages/getInvolved/GetInvolvedEditorPage"));
const AnnouncementsPage = lazy(() => import("./pages/announcements/AnnouncementsPage"));
const PopupPage = lazy(() => import("./pages/popups/PopupPage"));
const HighlightsPage = lazy(() => import("./pages/highlights/HighlightsPage"));
const StoryEditorPage = lazy(() => import("./pages/stories/StoryEditorPage"));
const MetricsPage = lazy(() => import("./pages/impact/MetricsPage"));
const MetricEditorPage = lazy(() => import("./pages/impact/MetricEditorPage"));
const TransparencyPage = lazy(() => import("./pages/transparency/TransparencyPage"));
const ReportsPage = lazy(() => import("./pages/transparency/ReportsPage"));
const ReportEditorPage = lazy(() => import("./pages/transparency/ReportEditorPage"));
const UsersPage = lazy(() => import("./pages/users/UsersPage"));
const SubmissionsPage = lazy(() => import("./pages/submissions/SubmissionsPage"));
const AccountPage = lazy(() => import("./pages/account/AccountPage"));

const DesignSystemPage = SHOW_DESIGN_SYSTEM ? lazy(() => import("./pages/design-system/DesignSystemPage")) : null;

export const ROUTES: RouteDefinition[] = [
  { path: "/", title: "Dashboard", breadcrumb: [{ label: "Dashboard" }], component: DashboardPage },
  { path: "/homepage", title: "Homepage", breadcrumb: [{ label: "Content" }, { label: "Homepage" }], component: HomepagePage },
  { path: "/about", title: "About page", breadcrumb: [{ label: "Content" }, { label: "About page" }], component: AboutPage },
  { path: "/team", title: "Team", breadcrumb: [{ label: "Content" }, { label: "Team" }], component: TeamPage },
  { path: "/team/:id", title: "Team member", breadcrumb: [{ label: "Content" }, { label: "Team", href: "/team" }, { label: "Edit team member" }], component: TeamEditorPage },
  { path: "/programs", title: "Programs", breadcrumb: [{ label: "Content" }, { label: "Programs" }], component: ProgramsPage },
  { path: "/programs/:id", title: "Program", breadcrumb: [{ label: "Content" }, { label: "Programs", href: "/programs" }, { label: "Edit program" }], component: ProgramEditorPage },
  { path: "/projects", title: "Projects", breadcrumb: [{ label: "Content" }, { label: "Projects" }], component: ProjectsPage },
  { path: "/projects/:id", title: "Project", breadcrumb: [{ label: "Content" }, { label: "Projects", href: "/projects" }, { label: "Edit project" }], component: ProjectEditorPage },
  { path: "/stories", title: "Stories", breadcrumb: [{ label: "Content" }, { label: "Stories" }], component: StoriesPage },
  { path: "/stories/:id", title: "Story", breadcrumb: [{ label: "Content" }, { label: "Stories", href: "/stories" }, { label: "Edit story" }], component: StoryEditorPage },
  { path: "/careers", title: "Careers page", breadcrumb: [{ label: "Content" }, { label: "Careers page" }], component: CareersPage },
  { path: "/how-we-work", title: "How We Work page", breadcrumb: [{ label: "Content" }, { label: "How We Work page" }], component: HowWeWorkPage },
  { path: "/policies", title: "Policies", breadcrumb: [{ label: "Content" }, { label: "Policies" }], component: PoliciesPage },
  { path: "/get-involved", title: "Get Involved", breadcrumb: [{ label: "Content" }, { label: "Get Involved" }], component: GetInvolvedPage },
  { path: "/get-involved/:id", title: "Get Involved page", breadcrumb: [{ label: "Content" }, { label: "Get Involved", href: "/get-involved" }, { label: "Edit page" }], component: GetInvolvedEditorPage },
  { path: "/policies/:id", title: "Policy", breadcrumb: [{ label: "Content" }, { label: "Policies", href: "/policies" }, { label: "Edit policy" }], component: PolicyEditorPage },
  { path: "/impact", title: "Impact page", breadcrumb: [{ label: "Content" }, { label: "Impact page" }], component: ImpactPage },
  { path: "/impact/figures", title: "Impact figures", breadcrumb: [{ label: "Content" }, { label: "Impact figures" }], component: MetricsPage },
  { path: "/impact/figures/:id", title: "Impact figure", breadcrumb: [{ label: "Content" }, { label: "Impact figures", href: "/impact/figures" }, { label: "Edit figure" }], component: MetricEditorPage },
  { path: "/transparency", title: "Transparency", breadcrumb: [{ label: "Content" }, { label: "Transparency" }], component: TransparencyPage },
  { path: "/transparency/documents", title: "Transparency documents", breadcrumb: [{ label: "Content" }, { label: "Transparency", href: "/transparency" }, { label: "Documents" }], component: ReportsPage },
  { path: "/transparency/documents/:id", title: "Transparency document", breadcrumb: [{ label: "Content" }, { label: "Transparency", href: "/transparency" }, { label: "Documents", href: "/transparency/documents" }, { label: "Edit document" }], component: ReportEditorPage },
  { path: "/appeals", title: "Appeals", breadcrumb: [{ label: "Content" }, { label: "Appeals" }], component: AppealsPage },
  { path: "/appeals/:id", title: "Appeal", breadcrumb: [{ label: "Content" }, { label: "Appeals", href: "/appeals" }, { label: "Edit appeal" }], component: AppealEditorPage },
  { path: "/donation-page", title: "Donation page", breadcrumb: [{ label: "Content" }, { label: "Donation page" }], component: DonationPageEditor },
  { path: "/posts", title: "Posts", breadcrumb: [{ label: "Content" }, { label: "Posts" }], component: PostsPage },
  { path: "/posts/:id", title: "Post", breadcrumb: [{ label: "Content" }, { label: "Posts", href: "/posts" }, { label: "Edit post" }], component: PostEditorPage },
  { path: "/events", title: "Events", breadcrumb: [{ label: "Content" }, { label: "Events" }], component: EventsPage },
  { path: "/events/:id", title: "Event", breadcrumb: [{ label: "Content" }, { label: "Events", href: "/events" }, { label: "Edit event" }], component: EventEditorPage },
  { path: "/media", title: "Media", breadcrumb: [{ label: "Content" }, { label: "Media" }], component: MediaLibraryPage },
  { path: "/announcements", title: "Announcement bar", breadcrumb: [{ label: "Engagement" }, { label: "Announcements" }], component: AnnouncementsPage },
  { path: "/popups", title: "Popup", breadcrumb: [{ label: "Engagement" }, { label: "Popups" }], component: PopupPage },
  { path: "/highlights", title: "Highlights", breadcrumb: [{ label: "Engagement" }, { label: "Highlights" }], component: HighlightsPage },
  { path: "/submissions", title: "Form submissions", breadcrumb: [{ label: "Engagement" }, { label: "Form submissions" }], component: SubmissionsPage, permission: "submissions:read" },
  { path: "/settings", title: "Settings", breadcrumb: [{ label: "System" }, { label: "Settings" }], component: SettingsPage },
  { path: "/users", title: "Users & Roles", breadcrumb: [{ label: "System" }, { label: "Users & Roles" }], component: UsersPage, permission: "users:read" },
  { path: "/account", title: "Your account", breadcrumb: [{ label: "Your account" }], component: AccountPage },
  ...(DesignSystemPage
    ? [{ path: "/design-system", title: "Design system", breadcrumb: [{ label: "Development" }, { label: "Design system" }], component: DesignSystemPage }]
    : []),
];

export const NOT_FOUND: RouteDefinition = { path: "*", title: "Page not found", breadcrumb: [{ label: "Dashboard", href: "/" }, { label: "Not found" }], component: NotFoundPage };

/* The route for a path, with its :parameters. Exact segments win over
   parameters, so "/posts" never matches "/posts/:id". */
export function routeFor(path: string): { route: RouteDefinition; params: Record<string, string> } {
  const parts = path.split("/").filter(Boolean);
  for (const route of ROUTES) {
    const pattern = route.path.split("/").filter(Boolean);
    if (pattern.length !== parts.length) continue;
    const params: Record<string, string> = {};
    const match = pattern.every((p, i) => {
      if (p.startsWith(":")) {
        try {
          params[p.slice(1)] = decodeURIComponent(parts[i]!);
        } catch {
          return false;
        }
        return true;
      }
      return p === parts[i];
    });
    if (match) return { route, params };
  }
  return { route: NOT_FOUND, params: {} };
}
