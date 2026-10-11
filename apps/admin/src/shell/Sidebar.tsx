import type { MouseEvent } from "react";
import { Badge, IconButton, Tooltip, X, cx } from "../design-system";
import { followLink } from "../router";
import { brand } from "../theme";
import { NAVIGATION, type NavItem } from "./navigation";
import styles from "./Sidebar.module.css";

const NAV_HREFS = NAVIGATION.flatMap((section) => section.items.map((item) => item.href).filter((h): h is string => Boolean(h)));

export interface SidebarProps {
  path: string;
  /** Icons only, with names in tooltips (tablet, or collapsed by choice). */
  rail?: boolean;
  /** Called after a link is followed — the mobile drawer closes on it. */
  onNavigate?: () => void;
  /** In the mobile drawer: a visible close button beside the brand. */
  onClose?: () => void;
  /** The member's permissions: items that need one they lack are hidden. */
  permissions?: readonly string[];
}

export function BrandMark({ size = 28 }: { size?: number }) {
  return brand.logo.src ? (
    <img className={styles.mark} src={brand.logo.src} alt="" width={size} height={size} />
  ) : (
    <span className={styles.monogram} style={{ width: size, height: size }} aria-hidden="true">
      {brand.logo.monogram}
    </span>
  );
}

export function Sidebar({ path, rail = false, onNavigate, onClose, permissions = [] }: SidebarProps) {
  const visible = (item: NavItem) => !item.permission || permissions.includes(item.permission);
  return (
    <div className={cx(styles.sidebar, rail && styles.rail)}>
      <div className={styles.brand}>
        <BrandMark />
        <span className={styles.brandText}>
          <span className={styles.product}>{brand.productName}</span>
          <span className={styles.organization}>{brand.organizationName}</span>
        </span>
        {onClose && <IconButton className={styles.close} label="Close navigation" icon={<X />} size="sm" onClick={onClose} />}
      </div>
      <nav className={styles.nav} aria-label="Main navigation">
        {NAVIGATION.map((section) => (
          <div key={section.id} className={styles.section}>
            <h2 className={styles.sectionLabel} id={`nav-${section.id}`}>
              {section.label}
            </h2>
            <ul aria-labelledby={`nav-${section.id}`} className={styles.items}>
              {section.items.filter(visible).map((item) => (
                <li key={item.id}>
                  <NavEntry item={item} path={path} rail={rail} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}

function NavEntry({ item, path, rail, onNavigate }: { item: NavItem; path: string; rail: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  if (item.status === "planned" || !item.href) {
    return (
      <Tooltip content={`${item.label} — coming in a later release`} side="right" disabled={!rail} labelOnly>
        <span className={cx(styles.item, styles.planned)} data-nav-item={item.id} data-planned="">
          <Icon className={styles.icon} size={16} />
          <span className={styles.label}>
            {item.label}
            <span className="ds-visually-hidden"> (coming soon)</span>
          </span>
          <Badge size="sm" className={styles.soon} aria-hidden="true">
            Soon
          </Badge>
        </span>
      </Tooltip>
    );
  }
  const href = item.href;
  const under = (h: string) => (h === "/" ? path === "/" : path === h || path.startsWith(`${h}/`));
  /* The most specific item is current: /impact/figures is "Impact
     figures", not also "Impact page". */
  const current = under(href) && !NAV_HREFS.some((h) => h.length > href.length && h.startsWith(`${href}/`) && under(h));
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    followLink(event, href);
    onNavigate?.();
  };
  return (
    <Tooltip content={item.label} side="right" disabled={!rail} labelOnly>
      <a href={href} className={styles.item} aria-current={current ? "page" : undefined} data-nav-item={item.id} onClick={onClick}>
        <Icon className={styles.icon} size={16} />
        <span className={styles.label}>{item.label}</span>
      </a>
    </Tooltip>
  );
}
