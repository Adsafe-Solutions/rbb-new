import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiRequestError, api, type AuthView } from "./api";

/* Who is signed in — held in React memory only. On load (and whenever the
   tab comes back into view) the admin asks GET /auth/me; the browser sends
   the HttpOnly cookie and the API decides. Nothing about the session is
   written to localStorage or sessionStorage, and nothing here is trusted
   for authorization: the API checks every request itself. */

type AuthState = { status: "loading" } | { status: "anonymous" } | { status: "authenticated"; view: AuthView };

interface AuthApi {
  state: AuthState;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const refresh = useCallback(async () => {
    try {
      setState({ status: "authenticated", view: await api<AuthView>("/api/v1/auth/me") });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) setState({ status: "anonymous" });
      else setState((current) => (current.status === "loading" ? { status: "anonymous" } : current));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const view = await api<AuthView>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    setState({ status: "authenticated", view });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/v1/auth/logout", { method: "POST" });
    } finally {
      setState({ status: "anonymous" });
    }
  }, []);

  useEffect(() => {
    void refresh();
    /* A session can expire or be revoked while the tab sits in the
       background: check again when it is shown. */
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const value = useMemo(() => ({ state, login, logout, refresh }), [state, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

/* Whether the signed-in member holds a permission (from /auth/me). For
   showing or hiding controls ONLY — the API checks every request itself,
   so hiding a button is a courtesy, never the protection. */
export function useCan(permission: string): boolean {
  const { state } = useAuth();
  return state.status === "authenticated" && state.view.permissions.includes(permission);
}
