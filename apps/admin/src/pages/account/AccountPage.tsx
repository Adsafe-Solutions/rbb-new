import { useState, type FormEvent } from "react";
import { ApiRequestError } from "../../api";
import { useAuth } from "../../auth";
import { Alert, Badge, Button, FormField, Input, PageContainer, PageHeader, Panel, useToast } from "../../design-system";
import { navigate } from "../../router";
import type { PageProps } from "../../routes";
import { accountApi } from "../../users/client";
import { PASSWORD_HELP, fieldProblems, messageFor, newPasswordProblems, roleLabel, type Problems } from "../../users/rules";
import styles from "../users/users.module.css";

/* /account — the signed-in member's own account (M17.3): who they are,
   and changing their password. The current password is required; the API
   then signs the account out EVERYWHERE and gives this browser a fresh
   session (same expiry) in the response's cookie, so the admin only
   re-reads /auth/me. Passwords live in this form's state until the request
   ends and are cleared either way. */

export default function AccountPage({ view }: PageProps) {
  const { refresh } = useAuth();
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [problems, setProblems] = useState<Problems>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found: Problems = { ...newPasswordProblems(next, confirm, current) };
    if (!current) found.current = "Enter your current password.";
    setProblems(found);
    setError(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await accountApi.changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast({ title: "Password changed", description: "You were signed out everywhere else. This browser stays signed in.", tone: "success" });
      await refresh(); // the response carried this browser's new session
    } catch (caught) {
      setCurrent("");
      const fields = fieldProblems(caught);
      if (caught instanceof ApiRequestError && caught.status === 401) {
        await refresh(); // the session is gone: the app returns to sign-in
        navigate("/login", { replace: true });
        return;
      }
      if (Object.keys(fields).length) setProblems({ current: fields.currentPassword, password: fields.newPassword });
      else setError(messageFor(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer width="narrow">
      <PageHeader title="Your account" description="Your sign-in details for this admin." />
      <div className={styles.stack}>
        <Panel title="Profile" description="Owners manage names, emails and roles from Users & Roles.">
          <dl className={styles.facts}>
            <div>
              <dt>Name</dt>
              <dd>{view.user.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{view.user.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>
                <Badge tone="brand" size="sm">
                  {roleLabel(view.membership.role)}
                </Badge>
              </dd>
            </div>
          </dl>
        </Panel>
        <Panel title="Change password" description="Changing it signs you out on every other device and browser.">
          <form className={styles.form} onSubmit={onSubmit} aria-busy={busy} noValidate data-testid="password-form">
            {error && (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            )}
            <FormField label="Current password" error={problems.current} required>
              <Input type="password" name="current-password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </FormField>
            <FormField label="New password" helper={PASSWORD_HELP} error={problems.password} required>
              <Input type="password" name="new-password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </FormField>
            <FormField label="Confirm new password" error={problems.confirm} required>
              <Input type="password" name="confirm-password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </FormField>
            <div className={styles.formActions}>
              <Button type="submit" variant="primary" loading={busy} disabled={!busy && (!current || !next || !confirm)}>
                Change password
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </PageContainer>
  );
}
