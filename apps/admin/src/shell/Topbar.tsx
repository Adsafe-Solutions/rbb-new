import { useState } from "react";
import { chooseMode, preferredMode } from "../theme/mode";
import { PUBLISH_HREF, badgeCount, formBreakdown, itemLabel, plural, sectionHref, type ReviewItem } from "../notifications/model";
import { useNotifications } from "../notifications/useNotifications";
import type { AuthView } from "../api";
import { useAuth } from "../auth";
import {
  Avatar,
  Badge,
  Bell,
  Breadcrumb,
  ChevronDown,
  CircleHelp,
  IconButton,
  Inbox,
  LogOut,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Moon,
  PanelLeft,
  Search,
  Send,
  Sun,
  Tooltip,
  UserRound,
  type BreadcrumbItem,
} from "../design-system";
import { navigate } from "../router";
import styles from "./Topbar.module.css";

export interface TopbarProps {
  view: AuthView;
  breadcrumb: BreadcrumbItem[];
  /** Opens the mobile drawer, or collapses/expands the sidebar. */
  onToggleNavigation: () => void;
  navigationLabel: string;
  navigationExpanded: boolean;
  navigationControls: string;
}

export const roleLabel = (role: string) => role.charAt(0) + role.slice(1).toLowerCase();

/* Search and help are PLACEHOLDERS for later milestones: visible so the
   layout is final, `aria-disabled` so they are focusable and their
   tooltips say plainly that they are not available yet. Neither pretends
   to work. Notifications are real (2026-10-13). */
export function Topbar({ view, breadcrumb, onToggleNavigation, navigationLabel, navigationExpanded, navigationControls }: TopbarProps) {
  return (
    <header className={styles.topbar}>
      <Tooltip content={navigationLabel} side="bottom" labelOnly>
        <IconButton label={navigationLabel} icon={<PanelLeft />} onClick={onToggleNavigation} aria-expanded={navigationExpanded} aria-controls={navigationControls} />
      </Tooltip>
      <span className={styles.divider} aria-hidden="true" />
      <Breadcrumb items={breadcrumb} onNavigate={(href) => navigate(href)} className={styles.breadcrumb} />
      <div className={styles.tools}>
        <Tooltip content="Search is not available yet" side="bottom">
          <button type="button" className={styles.search} aria-disabled="true" aria-label="Search">
            <Search size={16} />
            <span className={styles.searchText}>Search…</span>
          </button>
        </Tooltip>
        <Tooltip content="Help is not available yet" side="bottom">
          <IconButton label="Help" icon={<CircleHelp />} aria-disabled="true" className={styles.placeholder} />
        </Tooltip>
        <NotificationsMenu />
        <ThemeSwitch />
        <UserMenu view={view} />
      </div>
    </header>
  );
}

/* What is waiting: new form submissions, content waiting for review,
   approved changes not yet published, failed scheduled publications —
   each person only what they may see (the API decides). */
function NotificationsMenu() {
  const { data, refresh } = useNotifications();
  const count = badgeCount(data);
  const p = data?.publishing ?? null;
  const items = (list: ReviewItem[], total: number) => (
    <>
      {list.map((item, i) => (
        <MenuItem key={`${item.section}:${item.title}:${i}`} onSelect={() => navigate(sectionHref(item.section))}>
          {itemLabel(item)}
        </MenuItem>
      ))}
      {total > list.length && <MenuItem onSelect={() => navigate(PUBLISH_HREF)}>{`and ${total - list.length} more…`}</MenuItem>}
    </>
  );
  const empty = data !== null && !data.submissions?.new && !p?.submitted.total && !p?.approved.total && !p?.failedSchedules.length;
  return (
    <Menu
      align="end"
      minWidth={300}
      label="Notifications"
      trigger={(props) => (
        <span className={styles.bell}>
          <IconButton
            {...props}
            onClick={() => {
              void refresh();
              props.onClick();
            }}
            label={count ? `Notifications: ${count} waiting` : "Notifications"}
            icon={<Bell />}
            data-testid="notifications"
          />
          {count > 0 && (
            <span className={styles.bellCount} aria-hidden="true">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </span>
      )}
    >
      <MenuLabel>Notifications</MenuLabel>
      {data === null && <MenuItem disabled>Checking…</MenuItem>}
      {empty && <MenuItem disabled>You're all caught up.</MenuItem>}
      {data?.submissions && data.submissions.new > 0 && (
        <>
          <MenuSeparator />
          <MenuLabel>{`New form submissions (${data.submissions.new})`}</MenuLabel>
          {formBreakdown(data.submissions.byForm).map(([form, n]) => (
            <MenuItem key={form} icon={<Inbox />} onSelect={() => navigate("/submissions")}>
              {`${form}: ${plural(n, "new submission")}`}
            </MenuItem>
          ))}
        </>
      )}
      {p && p.failedSchedules.length > 0 && (
        <>
          <MenuSeparator />
          <MenuLabel>{p.failedSchedules.length === 1 ? "A scheduled publication failed" : `${p.failedSchedules.length} scheduled publications failed`}</MenuLabel>
          {items(p.failedSchedules, p.failedSchedules.length)}
        </>
      )}
      {p && p.submitted.total > 0 && (
        <>
          <MenuSeparator />
          <MenuLabel>{`Waiting for ${data?.canApprove ? "your " : ""}review (${p.submitted.total})`}</MenuLabel>
          {items(p.submitted.items, p.submitted.total)}
        </>
      )}
      {p && p.approved.total > 0 && (
        <>
          <MenuSeparator />
          <MenuLabel>{`Approved, not yet published (${p.approved.total})`}</MenuLabel>
          {items(p.approved.items, p.approved.total)}
          {data?.canPublish && (
            <MenuItem icon={<Send />} onSelect={() => navigate(PUBLISH_HREF)}>
              Review and publish the website
            </MenuItem>
          )}
        </>
      )}
    </Menu>
  );
}

/* Light (the default) or dark, remembered in this browser. */
function ThemeSwitch() {
  const [mode, setMode] = useState(preferredMode);
  const next = mode === "dark" ? "light" : "dark";
  const label = next === "dark" ? "Switch to dark theme" : "Switch to light theme";
  return (
    <Tooltip content={label} side="bottom" labelOnly>
      <IconButton
        label={label}
        icon={mode === "dark" ? <Sun /> : <Moon />}
        onClick={() => {
          chooseMode(next);
          setMode(next);
        }}
        data-testid="theme-switch"
      />
    </Tooltip>
  );
}

function UserMenu({ view }: { view: AuthView }) {
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    await logout();
    navigate("/login", { replace: true });
  }
  return (
    <Menu
      align="end"
      minWidth={240}
      trigger={(props) => (
        <button type="button" className={styles.account} disabled={busy} {...props}>
          <Avatar name={view.user.name} size="sm" decorative />
          <span className="ds-visually-hidden">Account: </span>
          <span className={styles.accountName}>{view.user.name}</span>
          <ChevronDown size={14} className={styles.chevron} />
        </button>
      )}
    >
      <MenuLabel>
        <span className={styles.menuName}>{view.user.name}</span>
        <span className={styles.menuEmail}>{view.user.email}</span>
        <Badge tone="brand" size="sm" className={styles.menuRole}>
          {roleLabel(view.membership.role)}
        </Badge>
      </MenuLabel>
      <MenuSeparator />
      <MenuItem icon={<UserRound />} onSelect={() => navigate("/account")}>
        Your account
      </MenuItem>
      <MenuItem icon={<LogOut />} onSelect={signOut}>
        Sign out
      </MenuItem>
    </Menu>
  );
}
