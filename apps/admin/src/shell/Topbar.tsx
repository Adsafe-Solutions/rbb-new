import { useState } from "react";
import { chooseMode, preferredMode } from "../theme/mode";
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
  LogOut,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Moon,
  PanelLeft,
  Search,
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

/* Search, help and notifications are PLACEHOLDERS for later milestones:
   visible so the layout is final, `aria-disabled` so they are focusable
   and their tooltips say plainly that they are not available yet. None of
   them pretends to work. */
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
        <Tooltip content="Notifications are not available yet" side="bottom">
          <IconButton label="Notifications" icon={<Bell />} aria-disabled="true" className={styles.placeholder} />
        </Tooltip>
        <ThemeSwitch />
        <UserMenu view={view} />
      </div>
    </header>
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
