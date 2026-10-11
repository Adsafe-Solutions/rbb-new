import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthView } from "../api";
import { Drawer, type BreadcrumbItem } from "../design-system";
import { useMediaQuery } from "../router";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import styles from "./AdminShell.module.css";

/* The signed-in frame. Three layouts, by width:

     ≥ 1024px   sidebar expanded (248px); the toggle collapses it to a rail
     768–1023   sidebar as a 60px icon rail; the toggle expands it
     < 768      no sidebar; the toggle opens it as a modal drawer

   The choice to collapse/expand is not remembered across widths: crossing
   a breakpoint returns to that width's default. */

export interface AdminShellProps {
  view: AuthView;
  path: string;
  breadcrumb: BreadcrumbItem[];
  children: ReactNode;
}

export function AdminShell({ view, path, breadcrumb, children }: AdminShellProps) {
  const mobile = useMediaQuery("(max-width: 767.98px)");
  const tablet = useMediaQuery("(min-width: 768px) and (max-width: 1023.98px)");
  const [override, setOverride] = useState<boolean | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const main = useRef<HTMLElement>(null);
  const firstPath = useRef(path);

  useEffect(() => {
    setOverride(null);
    if (!mobile) setDrawerOpen(false);
  }, [mobile, tablet]);

  // After an in-app navigation, move focus to the new page's content so a
  // screen reader starts there, as it would after a full page load.
  useEffect(() => {
    if (path === firstPath.current) return;
    firstPath.current = path;
    main.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [path]);

  const rail = override ?? tablet;
  const toggle = () => (mobile ? setDrawerOpen(true) : setOverride(!rail));
  const navigationLabel = mobile ? "Open navigation" : rail ? "Expand sidebar" : "Collapse sidebar";

  return (
    <div className={styles.shell} data-layout={mobile ? "mobile" : rail ? "rail" : "expanded"}>
      <a className={styles.skip} href="#main-content">
        Skip to content
      </a>
      {!mobile && (
        <aside className={styles.sidebar} id="admin-sidebar" aria-label="Sidebar">
          <Sidebar path={path} rail={rail} permissions={view.permissions} />
        </aside>
      )}
      <Drawer id="admin-drawer" open={mobile && drawerOpen} onClose={() => setDrawerOpen(false)} label="Navigation">
        <Sidebar path={path} onNavigate={() => setDrawerOpen(false)} onClose={() => setDrawerOpen(false)} permissions={view.permissions} />
      </Drawer>
      <div className={styles.main}>
        <Topbar
          view={view}
          breadcrumb={breadcrumb}
          onToggleNavigation={toggle}
          navigationLabel={navigationLabel}
          navigationExpanded={mobile ? drawerOpen : !rail}
          navigationControls={mobile ? "admin-drawer" : "admin-sidebar"}
        />
        <main ref={main} id="main-content" tabIndex={-1} className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
