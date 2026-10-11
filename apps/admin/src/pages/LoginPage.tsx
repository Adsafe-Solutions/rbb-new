import { useState, type FormEvent } from "react";
import { ApiRequestError } from "../api";
import { useAuth } from "../auth";
import { Alert, Button, FormField, Input } from "../design-system";
import { navigate } from "../router";
import { BrandMark } from "../shell/Sidebar";
import { brand } from "../theme";
import styles from "./LoginPage.module.css";

/* Sign in. No registration and no password-reset link: neither exists
   yet, and a link that goes nowhere would be dishonest. */

const messageFor = (error: unknown) => {
  if (!(error instanceof ApiRequestError)) return "Something went wrong. Try again.";
  if (error.status === 401) return "Email or password is incorrect.";
  if (error.status === 429) {
    const minutes = Math.max(1, Math.ceil((error.retryAfterSeconds ?? 60) / 60));
    return `Too many sign-in attempts. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  }
  if (error.status === 400) return "Enter your email and password.";
  if (error.status === 0 || error.status >= 500) return "The server could not be reached. Try again shortly.";
  return "Sign-in is not available right now.";
};

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (caught) {
      setError(messageFor(caught));
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <BrandMark size={40} />
          <h1 className={styles.title}>Sign in to {brand.productName}</h1>
          <p className={styles.subtitle}>{brand.organizationName}</p>
        </div>
        <form className={styles.form} onSubmit={onSubmit} aria-busy={busy} noValidate>
          {error && (
            <Alert tone="danger" role="alert">
              {error}
            </Alert>
          )}
          <FormField label="Email">
            <Input type="email" name="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          <FormField label="Password">
            <Input type="password" name="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormField>
          <Button type="submit" variant="primary" size="lg" fullWidth loading={busy} disabled={!busy && (!email || !password)}>
            Sign in
          </Button>
        </form>
      </div>
      <p className={styles.footnote}>Access is by invitation from your organization.</p>
    </main>
  );
}
