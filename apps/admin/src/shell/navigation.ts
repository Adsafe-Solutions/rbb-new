import { SHOW_DESIGN_SYSTEM } from "../config";
import {
  AppWindow,
  Briefcase,
  BookOpen,
  CalendarDays,
  ChartBar,
  FileText,
  FolderKanban,
  HandCoins,
  HandHelping,
  HeartHandshake,
  House,
  History,
  Image,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  Newspaper,
  Palette,
  Scale,
  Settings,
  Sparkles,
  Users,
  type IconComponent,
} from "../design-system";

/* The sidebar's map of the admin. Modules that do not exist yet are
   listed as "planned": they show where the product is going, are clearly
   marked "Soon", and are not links — there is nothing behind them. Each
   becomes "available" (with an href) in the milestone that builds it. */

export interface NavItem {
  id: string;
  label: string;
  icon: IconComponent;
  status: "available" | "planned";
  href?: string;
  /* Shown only to members holding it (navigation only; the API decides). */
  permission?: string;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  { id: "main", label: "Main", items: [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard, status: "available", href: "/" }] },
  {
    id: "content",
    label: "Content",
    items: [
      { id: "homepage", label: "Homepage", icon: House, status: "available", href: "/homepage" },
      { id: "about", label: "About page", icon: FileText, status: "available", href: "/about" },
      { id: "team", label: "Team", icon: Users, status: "available", href: "/team" },
      { id: "programs", label: "Programs", icon: LayoutGrid, status: "available", href: "/programs" },
      { id: "projects", label: "Projects", icon: FolderKanban, status: "available", href: "/projects" },
      { id: "stories", label: "Stories", icon: BookOpen, status: "available", href: "/stories" },
      { id: "impact", label: "Impact page", icon: ChartBar, status: "available", href: "/impact" },
      { id: "impact-figures", label: "Impact figures", icon: ChartBar, status: "available", href: "/impact/figures" },
      { id: "transparency", label: "Transparency", icon: Landmark, status: "available", href: "/transparency" },
      { id: "careers", label: "Careers page", icon: Briefcase, status: "available", href: "/careers" },
      { id: "policies", label: "Policies", icon: Scale, status: "available", href: "/policies" },
      { id: "get-involved", label: "Get Involved", icon: HandHelping, status: "available", href: "/get-involved" },
      { id: "pages", label: "Pages", icon: FileText, status: "planned" },
      { id: "appeals", label: "Appeals", icon: HeartHandshake, status: "available", href: "/appeals" },
      { id: "donation-page", label: "Donation page", icon: HandCoins, status: "available", href: "/donation-page" },
      { id: "posts", label: "Posts", icon: Newspaper, status: "available", href: "/posts" },
      { id: "events", label: "Events", icon: CalendarDays, status: "available", href: "/events" },
      { id: "media", label: "Media", icon: Image, status: "available", href: "/media" },
    ],
  },
  {
    id: "engagement",
    label: "Engagement",
    items: [
      { id: "announcements", label: "Announcements", icon: Megaphone, status: "available", href: "/announcements" },
      { id: "popups", label: "Popups", icon: AppWindow, status: "available", href: "/popups" },
      { id: "highlights", label: "Highlights", icon: Sparkles, status: "available", href: "/highlights" },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { id: "settings", label: "Settings", icon: Settings, status: "available", href: "/settings" },
      { id: "users", label: "Users & Roles", icon: Users, status: "available", href: "/users", permission: "users:read" },
      { id: "audit", label: "Audit Log", icon: History, status: "planned" },
    ],
  },
  ...(SHOW_DESIGN_SYSTEM
    ? [{ id: "development", label: "Development", items: [{ id: "design-system", label: "Design system", icon: Palette, status: "available" as const, href: "/design-system" }] }]
    : []),
];
