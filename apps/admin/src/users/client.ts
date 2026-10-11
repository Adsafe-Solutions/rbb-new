import { api, type AuthView } from "../api";

/* The team (M17.1) and account security (M17.2) endpoints. Owners only for
   /members — the API checks every call; the admin only hides what a member
   cannot use. Nothing here keeps a token: a setup link's token comes back
   from issueSetupLink, is shown once by the caller, and is dropped. */

export type MemberRole = "OWNER" | "EDITOR";

/* What GET /api/v1/members returns per member — the API's MemberView. No
   password hash, token or storage field is ever part of it. */
export interface MemberView {
  id: string;
  email: string;
  name: string;
  role: MemberRole;
  /* Effective: disabled if the account or the membership is. */
  status: "active" | "disabled";
  /* false until the member has set a password from a setup link. */
  passwordSet: boolean;
  activeSessions: number;
  createdAt: string;
  updatedAt: string;
  /* Role and status changes quote it; a stale one is refused (409). */
  revision: number;
  isYou: boolean;
}

export interface SetupLink {
  token: string;
  expiresAt: string;
}

const post = <T>(path: string, body: unknown = {}) => api<T>(path, { method: "POST", body: JSON.stringify(body) });
const member = (id: string, action: string) => `/api/v1/members/${encodeURIComponent(id)}/${action}`;

export const membersApi = {
  list: () => api<MemberView[]>("/api/v1/members"),
  create: (input: { email: string; name: string; role: MemberRole }) => post<MemberView>("/api/v1/members", input),
  changeRole: (m: MemberView, role: MemberRole) => post<MemberView>(member(m.id, "role"), { revision: m.revision, role }),
  deactivate: (m: MemberView) => post<MemberView>(member(m.id, "deactivate"), { revision: m.revision }),
  reactivate: (m: MemberView) => post<MemberView>(member(m.id, "reactivate"), { revision: m.revision }),
  revokeSessions: (m: MemberView) => post<{ revoked: number }>(member(m.id, "sessions/revoke")),
  issueSetupLink: (m: MemberView) => post<SetupLink>(member(m.id, "setup-link")),
};

export const accountApi = {
  /* The API revokes every session of the account and sets a fresh session
     cookie (same expiry) on this response. */
  changePassword: (currentPassword: string, newPassword: string) => post<AuthView>("/api/v1/auth/password", { currentPassword, newPassword }),
  /* No session needed; it does not sign in. */
  setupPassword: (token: string, password: string) => post<{ passwordSet: true }>("/api/v1/auth/setup-password", { token, password }),
};
