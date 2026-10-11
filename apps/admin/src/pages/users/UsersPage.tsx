import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ApiRequestError } from "../../api";
import {
  Alert,
  Badge,
  Button,
  Copy,
  Dialog,
  Ellipsis,
  EmptyState,
  FormField,
  IconButton,
  Input,
  KeyRound,
  LogOut,
  Menu,
  MenuItem,
  PageContainer,
  PageHeader,
  Plus,
  Select,
  ShieldCheck,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableLoading,
  TableRow,
  UserCheck,
  UserX,
  Users,
  useToast,
} from "../../design-system";
import { navigate } from "../../router";
import type { PageProps } from "../../routes";
import { membersApi, type MemberRole, type MemberView, type SetupLink } from "../../users/client";
import { ROLE_HELP, actionsFor, fieldProblems, memberProblems, messageFor, roleLabel, setupLinkFor, type Problems } from "../../users/rules";
import styles from "./users.module.css";

/* /users — Users & Roles (M17.3). Owners only: the route is guarded by
   users:read, and every change is authorized by the API again, which also
   refuses changes to yourself, stale revisions and removing the last active
   owner. This page offers only what the API would accept (users/rules.ts).

   Setup links: the API returns a link's token once. It is held in the link
   dialog's state only — never in storage, the URL, a toast or the log —
   and dropped when the dialog closes. There is no way to see it again: a
   new link (which revokes the old one) must be issued on purpose. */

type ListState = { status: "loading" } | { status: "failed" } | { status: "ready"; members: MemberView[] };
type Confirm = { kind: "role" | "deactivate" | "reactivate" | "revoke" | "issue"; member: MemberView };

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const ROLE_OPTIONS = [
  { value: "EDITOR", label: "Editor" },
  { value: "OWNER", label: "Owner" },
];

export default function UsersPage(_: PageProps) {
  const { toast } = useToast();
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [conflict, setConflict] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [link, setLink] = useState<{ member: MemberView; link: SetupLink } | null>(null);
  const [busy, setBusy] = useState(false);

  /* Only the newest list request may fill the table, and a change made here
     outdates any request still in flight — a slow list must never replace a
     member just added or changed with what it read before. */
  const generation = useRef(0);
  const load = useCallback(async () => {
    const mine = ++generation.current;
    setConflict(null);
    try {
      const members = await membersApi.list();
      if (mine === generation.current) setList({ status: "ready", members });
    } catch {
      if (mine === generation.current) setList({ status: "failed" });
    }
  }, []);
  useEffect(() => void load(), [load]);

  const update = (change: (members: MemberView[]) => MemberView[]) => {
    generation.current++;
    setList((s) => (s.status === "ready" ? { status: "ready", members: change(s.members) } : s));
  };
  const replace = (member: MemberView) => update((members) => members.map((m) => (m.id === member.id ? member : m)));

  /* One API call behind a confirmation: success feedback, or the API's
     reason. A 409 (changed elsewhere / last owner / busy) keeps the page
     honest by reloading the list. */
  async function act(run: () => Promise<string>) {
    setBusy(true);
    try {
      toast({ title: await run(), tone: "success" });
      setConfirm(null);
    } catch (caught) {
      setConfirm(null);
      if (caught instanceof ApiRequestError && caught.status === 409) {
        await load();
        setConflict(caught.message);
      } else toast({ title: messageFor(caught, "That change could not be made."), tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function issue(member: MemberView) {
    setBusy(true);
    try {
      const issued = await membersApi.issueSetupLink(member);
      setConfirm(null);
      setLink({ member, link: issued });
    } catch (caught) {
      setConfirm(null);
      toast({ title: messageFor(caught, "The setup link could not be issued."), tone: "danger" });
      if (caught instanceof ApiRequestError && caught.status === 409) void load();
    } finally {
      setBusy(false);
    }
  }

  const add = (
    <Button variant="primary" leadingIcon={<Plus />} onClick={() => setCreating(true)}>
      Add member
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader
        title="Users & Roles"
        description="Who can sign in to this admin, and what they can do. New members get a single-use setup link from you to choose their password."
        actions={add}
      />
      {conflict && (
        <Alert tone="warning" role="alert" title="Not changed" className={styles.notice}>
          {conflict}
        </Alert>
      )}
      {list.status === "failed" ? (
        <EmptyState bordered icon={Users} title="The team could not be loaded" description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} />
      ) : (
        <Table label="Team members" loading={list.status === "loading"} data-testid="members-table">
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Password</TableHead>
              <TableHead align="end">Sessions</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead shrink>
                <span className="ds-visually-hidden">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.status === "loading" ? (
              <TableLoading colSpan={7} />
            ) : list.members.length === 0 ? (
              <TableEmpty colSpan={7} icon={Users} title="No members yet" description="Add the people who should be able to sign in." />
            ) : (
              list.members.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  onAction={(kind) => setConfirm({ kind, member })}
                />
              ))
            )}
          </TableBody>
        </Table>
      )}
      {list.status === "ready" && list.members.length === 1 && list.members[0]!.isYou && (
        <p className={styles.muted}>You are the only member so far. Add someone with “Add member”.</p>
      )}

      <CreateDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(member) => {
          update((members) => [...members, member]);
          toast({ title: `${member.name} added`, description: "They cannot sign in until they set a password from a setup link.", tone: "success" });
        }}
        onIssue={(member) => {
          setCreating(false);
          void issue(member);
        }}
      />

      {confirm?.kind === "role" && (
        <RoleDialog
          member={confirm.member}
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={(role) =>
            act(async () => {
              const saved = await membersApi.changeRole(confirm.member, role);
              replace(saved);
              return `${saved.name} is now ${roleLabel(saved.role).toLowerCase() === "owner" ? "an owner" : "an editor"}`;
            })
          }
        />
      )}
      <Dialog
        open={confirm?.kind === "deactivate"}
        onClose={() => setConfirm(null)}
        size="sm"
        title={`Deactivate ${confirm?.member.name ?? "this member"}?`}
        description="They are signed out everywhere at once and cannot sign in until an owner reactivates them. Any open setup link stops working. Their work and history are kept."
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              loading={busy}
              onClick={() =>
                act(async () => {
                  const saved = await membersApi.deactivate(confirm!.member);
                  replace(saved);
                  return `${saved.name} deactivated`;
                })
              }
            >
              Deactivate
            </Button>
          </>
        }
      />
      <Dialog
        open={confirm?.kind === "reactivate"}
        onClose={() => setConfirm(null)}
        size="sm"
        title={`Reactivate ${confirm?.member.name ?? "this member"}?`}
        description={
          confirm?.member.passwordSet
            ? "They can sign in again with their existing password. Sessions ended by the deactivation stay ended."
            : "They have not set a password yet: issue them a new setup link afterwards."
        }
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              onClick={() =>
                act(async () => {
                  const saved = await membersApi.reactivate(confirm!.member);
                  replace(saved);
                  return `${saved.name} reactivated`;
                })
              }
            >
              Reactivate
            </Button>
          </>
        }
      />
      <Dialog
        open={confirm?.kind === "revoke"}
        onClose={() => setConfirm(null)}
        size="sm"
        title={`Sign ${confirm?.member.name ?? "this member"} out everywhere?`}
        description="Every browser where they are signed in is signed out now. They can sign in again with their password."
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              loading={busy}
              onClick={() =>
                act(async () => {
                  const { revoked } = await membersApi.revokeSessions(confirm!.member);
                  replace({ ...confirm!.member, activeSessions: 0 });
                  return revoked === 1 ? "1 session ended" : `${revoked} sessions ended`;
                })
              }
            >
              Sign out everywhere
            </Button>
          </>
        }
      />
      <Dialog
        open={confirm?.kind === "issue"}
        onClose={() => setConfirm(null)}
        size="sm"
        title={`Issue a setup link for ${confirm?.member.name ?? "this member"}?`}
        description="The link lets them choose their password. It works once, expires after 72 hours, and is shown to you only once. Any earlier link for them stops working."
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={() => confirm && issue(confirm.member)}>
              Issue link
            </Button>
          </>
        }
      />

      {link && <SetupLinkDialog member={link.member} link={link.link} onClose={() => setLink(null)} />}
    </PageContainer>
  );
}

function MemberRow({ member, onAction }: { member: MemberView; onAction: (kind: Confirm["kind"]) => void }) {
  const actions = actionsFor(member);
  return (
    <TableRow data-member-id={member.id}>
      <TableCell>
        <span className={styles.name}>
          {member.name} {member.isYou && <Badge size="sm">You</Badge>}
        </span>
        <span className={styles.email}>{member.email}</span>
      </TableCell>
      <TableCell>
        <Badge tone={member.role === "OWNER" ? "brand" : "neutral"} size="sm">
          {roleLabel(member.role)}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge tone={member.status === "active" ? "success" : "neutral"} size="sm" data-status={member.status}>
          {member.status === "active" ? "Active" : "Deactivated"}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge tone={member.passwordSet ? "neutral" : "warning"} size="sm" data-password={member.passwordSet ? "set" : "pending"}>
          {member.passwordSet ? "Set" : "Awaiting setup"}
        </Badge>
      </TableCell>
      <TableCell align="end" mono data-sessions>
        {member.activeSessions}
      </TableCell>
      <TableCell muted>
        {dateFormat.format(new Date(member.updatedAt))}
        <span className={styles.muted}> · rev {member.revision}</span>
      </TableCell>
      <TableCell shrink>
        {member.isYou ? (
          <Button size="sm" variant="ghost" onClick={() => navigate("/account")}>
            Your account
          </Button>
        ) : actions.length === 0 ? null : (
          <Menu align="end" trigger={(props) => <IconButton {...props} size="sm" label={`Actions for ${member.name}`} icon={<Ellipsis />} />}>
            {actions.includes("role") && (
              <MenuItem icon={<ShieldCheck />} onSelect={() => onAction("role")}>
                Change role…
              </MenuItem>
            )}
            {actions.includes("setupLink") && (
              <MenuItem icon={<KeyRound />} onSelect={() => onAction("issue")}>
                Issue setup link…
              </MenuItem>
            )}
            {actions.includes("revokeSessions") && (
              <MenuItem icon={<LogOut />} onSelect={() => onAction("revoke")}>
                Sign out everywhere…
              </MenuItem>
            )}
            {actions.includes("reactivate") && (
              <MenuItem icon={<UserCheck />} onSelect={() => onAction("reactivate")}>
                Reactivate…
              </MenuItem>
            )}
            {actions.includes("deactivate") && (
              <MenuItem icon={<UserX />} destructive onSelect={() => onAction("deactivate")}>
                Deactivate…
              </MenuItem>
            )}
          </Menu>
        )}
      </TableCell>
    </TableRow>
  );
}

function RoleDialog({ member, busy, onClose, onConfirm }: { member: MemberView; busy: boolean; onClose: () => void; onConfirm: (role: MemberRole) => void }) {
  const [role, setRole] = useState<MemberRole>(member.role);
  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={`Change ${member.name}'s role`}
      description="The change applies on their very next request — no need for them to sign in again."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={role === member.role} onClick={() => onConfirm(role)}>
            Change role
          </Button>
        </>
      }
    >
      <div className={styles.dialogBody}>
        <FormField label="Role" helper={ROLE_HELP[role]}>
          <Select options={ROLE_OPTIONS} value={role} onChange={(e) => setRole(e.target.value as MemberRole)} />
        </FormField>
        {role === "OWNER" && role !== member.role && (
          <Alert tone="warning">Owners can manage the team — including other owners — publish the website and change settings.</Alert>
        )}
      </div>
    </Dialog>
  );
}

function CreateDialog({ open, onClose, onCreated, onIssue }: { open: boolean; onClose: () => void; onCreated: (member: MemberView) => void; onIssue: (member: MemberView) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("EDITOR");
  const [problems, setProblems] = useState<Problems>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<MemberView | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setName("");
      setEmail("");
      setRole("EDITOR");
      setProblems({});
      setError(null);
      setCreated(null);
    }
  }, [open]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const found = memberProblems({ name, email });
    setProblems(found);
    setError(null);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const member = await membersApi.create({ name: name.trim(), email: email.trim(), role });
      setCreated(member);
      onCreated(member);
    } catch (caught) {
      const fields = fieldProblems(caught);
      if (caught instanceof ApiRequestError && caught.status === 409) setProblems({ email: caught.message });
      else if (Object.keys(fields).length) setProblems(fields);
      else setError(messageFor(caught, "The member could not be added."));
    } finally {
      setBusy(false);
    }
  }

  if (created)
    return (
      <Dialog
        open={open}
        onClose={onClose}
        size="sm"
        title={`${created.name} was added`}
        description="They cannot sign in yet. Issue a setup link and give it to them yourself — through a channel you trust — so they can choose their password."
        footer={
          <>
            <Button onClick={onClose}>Later</Button>
            <Button variant="primary" leadingIcon={<KeyRound />} onClick={() => onIssue(created)}>
              Issue setup link
            </Button>
          </>
        }
      />
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a member"
      description="They get no email. After adding them, you issue a setup link and hand it over yourself."
      initialFocus={nameRef}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="add-member" variant="primary" loading={busy}>
            Add member
          </Button>
        </>
      }
    >
      <form id="add-member" className={styles.dialogBody} onSubmit={onSubmit} noValidate aria-busy={busy}>
        {error && (
          <Alert tone="danger" role="alert">
            {error}
          </Alert>
        )}
        <FormField label="Name" error={problems.name} required>
          <Input ref={nameRef} name="name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Email" error={problems.email} required helper="The address they will sign in with.">
          <Input type="email" name="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label="Role" helper={ROLE_HELP[role]} error={problems.role}>
          <Select options={ROLE_OPTIONS} value={role} onChange={(e) => setRole(e.target.value as MemberRole)} />
        </FormField>
      </form>
    </Dialog>
  );
}

/* The one time a setup link is shown. Its token is in this component's
   props only; closing the dialog drops it. */
function SetupLinkDialog({ member, link, onClose }: { member: MemberView; link: SetupLink; onClose: () => void }) {
  const { toast } = useToast();
  const url = setupLinkFor(window.location.origin, link.token);
  const [copied, setCopied] = useState<"no" | "yes" | "failed">("no");
  const inputRef = useRef<HTMLInputElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied("yes");
      toast({ title: "Setup link copied", tone: "success" });
    } catch {
      setCopied("failed");
      inputRef.current?.select();
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      dismissOnBackdrop={false}
      title={`Setup link for ${member.name}`}
      description={`Send it to ${member.email} yourself. It is shown only now.`}
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className={styles.dialogBody} data-testid="setup-link-dialog">
        <Alert tone="warning" title="Anyone with this link can set this account's password">
          Share it only with {member.name}, through a channel you trust. It works once and expires {dateTimeFormat.format(new Date(link.expiresAt))}. If it is lost, issue a new one —
          that also stops this one working.
        </Alert>
        <FormField label="Setup link" helper={copied === "failed" ? "Copying is not available here — the link is selected: copy it yourself." : undefined}>
          <div className={styles.linkRow}>
            <Input ref={inputRef} readOnly value={url} className={styles.linkInput} onFocus={(e) => e.currentTarget.select()} data-testid="setup-link-value" spellCheck={false} />
            <Button leadingIcon={<Copy />} onClick={copy}>
              {copied === "yes" ? "Copied" : "Copy link"}
            </Button>
          </div>
        </FormField>
      </div>
    </Dialog>
  );
}
