import type { Logger } from "../logging/logger.ts";

/* A deliberately small router: method + path pattern ("/a/:slug"), path
   parameters returned raw — each route validates its own with Zod. No
   framework: the API is a Fetch-standard `Request → Response` function,
   which is what Vercel's Node runtime invokes and what the web's existing
   form endpoint already is. */

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface Context {
  request: Request;
  url: URL;
  params: Record<string, string>;
  requestId: string;
  log: Logger;
}

export type Handler = (context: Context) => Response | Promise<Response>;

export interface Route {
  method: Method;
  path: string;
  handler: Handler;
  /* Liveness routes answer even when the configuration is invalid. */
  live?: boolean;
}

export type Match =
  | { kind: "route"; route: Route; params: Record<string, string> }
  | { kind: "method-not-allowed"; allowed: Method[] }
  | { kind: "not-found" };

const segments = (path: string) => path.split("/").filter(Boolean);

export function createRouter(routes: Route[]) {
  const compiled = routes.map((route) => ({ route, parts: segments(route.path) }));

  return {
    /* `pathname` is the URL's raw path; a malformed %-escape throws
       URIError, which the app answers as a bad request. */
    match(method: string, pathname: string): Match {
      const parts = segments(pathname);
      const allowed: Method[] = [];
      for (const { route, parts: pattern } of compiled) {
        if (pattern.length !== parts.length) continue;
        const params: Record<string, string> = {};
        const matches = pattern.every((part, i) => {
          if (part.startsWith(":")) {
            params[part.slice(1)] = decodeURIComponent(parts[i]!);
            return true;
          }
          return part === parts[i];
        });
        if (!matches) continue;
        if (route.method === method) return { kind: "route", route, params };
        allowed.push(route.method);
      }
      return allowed.length ? { kind: "method-not-allowed", allowed } : { kind: "not-found" };
    },
  };
}
