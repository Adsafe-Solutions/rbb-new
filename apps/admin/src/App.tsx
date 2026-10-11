import { Suspense, useEffect } from "react";
import { AuthProvider, useAuth } from "./auth";
import { Spinner, ToastProvider } from "./design-system";
import { LoginPage } from "./pages/LoginPage";
import { NoAccessPage } from "./pages/NoAccessPage";
import { SetupPasswordPage } from "./pages/SetupPasswordPage";
import { Redirect, usePath } from "./router";
import { routeFor } from "./routes";
import { AdminShell } from "./shell/AdminShell";
import { brand } from "./theme";
import styles from "./App.module.css";

function FullScreenSpinner() {
  return (
    <div className={styles.loading}>
      <Spinner size="lg" label="Loading" />
    </div>
  );
}

/* /login for anyone signed out; /setup-password for anyone (a new member
   has no password yet — M17.2); every other path is the signed-in shell.
   The guards here are for navigation only — the API authorizes every
   request itself. */
function Screens() {
  const { state } = useAuth();
  const path = usePath();
  const { route, params } = routeFor(path);
  const title = path === "/login" ? "Sign in" : path === "/setup-password" ? "Set your password" : route.title;

  useEffect(() => {
    document.title = `${title} · ${brand.productName}`;
  }, [title]);

  /* Before the session check: the page must take its token off the address
     bar at once, whoever is (or is not) signed in. */
  if (path === "/setup-password") return <SetupPasswordPage />;
  if (state.status === "loading") return <FullScreenSpinner />;
  if (path === "/login") return state.status === "authenticated" ? <Redirect to="/" /> : <LoginPage />;
  if (state.status !== "authenticated") return <Redirect to="/login" />;

  const allowed = !route.permission || state.view.permissions.includes(route.permission);
  const Page = allowed ? route.component : NoAccessPage;
  return (
    <AdminShell view={state.view} path={path} breadcrumb={route.breadcrumb}>
      <Suspense fallback={<FullScreenSpinner />}>
        <Page view={state.view} params={params} />
      </Suspense>
    </AdminShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Screens />
      </ToastProvider>
    </AuthProvider>
  );
}
