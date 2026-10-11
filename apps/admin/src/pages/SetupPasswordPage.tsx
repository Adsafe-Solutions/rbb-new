import { useEffect, useState, type FormEvent } from "react";
import { ApiRequestError } from "../api";
import { Alert, Button, FormField, Input } from "../design-system";
import { navigate } from "../router";
import { BrandMark } from "../shell/Sidebar";
import { brand } from "../theme";
import { accountApi } from "../users/client";
import { PASSWORD_HELP, fieldProblems, messageFor, newPasswordProblems, readSetupToken, type Problems } from "../users/rules";
import styles from "./LoginPage.module.css";

/* /setup-password#token=… — a new member sets their first password from
   the link an owner gave them (M17.2). Public: they have no password yet.

   The token lives in the URL FRAGMENT, which the browser never sends to a
   server. It is read once, the address bar is cleared at once (so it is
   not left in history, bookmarks or over someone's shoulder), and it is
   kept only in this component's memory until the submission ends — never
   in storage, logs or analytics. The API answers every unusable link the
   same way, so this page cannot tell expired from used from unknown. */

type Phase = "form" | "done" | "invalid";

const MISSING = "This setup link is incomplete. Open the full link you were given, or ask an owner for a new one.";

export function SetupPasswordPage() {
  /* Read once, during the first render; nothing else ever reads the hash. */
  const [token, setToken] = useState<string | null>(() => readSetupToken(window.location.hash));
  const [phase, setPhase] = useState<Phase>(() => (token ? "form" : "invalid"));
  const [invalidReason, setInvalidReason] = useState(MISSING);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [problems, setProblems] = useState<Problems>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Off the address bar (and out of this history entry) straight away.
    const clear = () => window.location.hash && window.history.replaceState(null, "", window.location.pathname);
    clear();
    /* Another link opened in this same tab changes only the fragment (no
       page load): take it the same way — read once, clear at once. */
    const onHashChange = () => {
      const next = readSetupToken(window.location.hash);
      clear();
      if (!next) return;
      setToken(next);
      setPassword("");
      setConfirm("");
      setProblems({});
      setError(null);
      setPhase("form");
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy || !token) return;
    const found = newPasswordProblems(password, confirm);
    setProblems(found);
    setError(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await accountApi.setupPassword(token, password);
      setToken(null);
      setPassword("");
      setConfirm("");
      setPhase("done");
    } catch (caught) {
      const fields = fieldProblems(caught);
      if (caught instanceof ApiRequestError && caught.status === 400 && !Object.keys(fields).length) {
        // Used, expired, revoked or unknown: the link is finished either way.
        setToken(null);
        setPassword("");
        setConfirm("");
        setInvalidReason(caught.message || "This setup link is invalid, already used or expired. Ask an owner for a new one.");
        setPhase("invalid");
      } else if (Object.keys(fields).length) {
        setProblems({ password: fields.password ?? "Choose another password." });
      } else {
        setError(messageFor(caught));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <BrandMark size={40} />
          <h1 className={styles.title}>{phase === "done" ? "Your password is set" : "Set your password"}</h1>
          <p className={styles.subtitle}>{brand.organizationName}</p>
        </div>

        {phase === "form" && (
          <form className={styles.form} onSubmit={onSubmit} aria-busy={busy} noValidate data-testid="setup-form">
            <p className={styles.lede}>Choose the password you will use to sign in to {brand.productName}. This link works once.</p>
            {error && (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            )}
            <FormField label="New password" helper={PASSWORD_HELP} error={problems.password} required>
              <Input type="password" name="new-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </FormField>
            <FormField label="Confirm new password" error={problems.confirm} required>
              <Input type="password" name="confirm-password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </FormField>
            <Button type="submit" variant="primary" size="lg" fullWidth loading={busy} disabled={!busy && (!password || !confirm)}>
              Set password
            </Button>
          </form>
        )}

        {phase === "done" && (
          <div className={styles.form} data-testid="setup-done">
            <Alert tone="success" role="status">
              You can now sign in with your email and the password you just chose.
            </Alert>
            <Button variant="primary" size="lg" fullWidth onClick={() => navigate("/login", { replace: true })}>
              Sign in
            </Button>
          </div>
        )}

        {phase === "invalid" && (
          <div className={styles.form} data-testid="setup-invalid">
            <Alert tone="warning" role="alert" title="This link cannot be used">
              {invalidReason}
            </Alert>
            <Button size="lg" fullWidth onClick={() => navigate("/login", { replace: true })}>
              Go to sign in
            </Button>
          </div>
        )}
      </div>
      <p className={styles.footnote}>Setup links are single-use and expire after 72 hours.</p>
    </main>
  );
}
