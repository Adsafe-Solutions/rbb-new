import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "../../api";
import { useCan } from "../../auth";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  EmptyState,
  ExternalLink,
  Inbox,
  Input,
  PageContainer,
  PageHeader,
  Search,
  Select,
  Spinner,
  Table,
  TableBody,
  Textarea,
  FormField,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableLoading,
  TableRow,
  Trash2,
  useToast,
} from "../../design-system";
import type { PageProps } from "../../routes";
import { submissionsApi, type Submission, type SubmissionCounts, type SubmissionSummary } from "../../submissions/client";
import { FORM_LABELS, NO_FILTERS, fieldRows, formLabel, replyHref, topicLabel, type SubmissionFilters } from "../../submissions/format";
import styles from "./submissions.module.css";

/* /submissions — what visitors sent through the website's Contact Us,
   Volunteer and Partner With Us forms (2026-10-13). Owners only: the
   route needs submissions:read and the API checks every request. Newest
   first, filtered by form, new/read, dates and text; opening one shows
   every field and marks it read. A reply can be written and sent from
   here — emailed to the visitor from RBB's address, Reply-To the form's
   RBB inbox, and kept with the submission — while email is set up; the
   member's own mail program is always offered too. Kept until an owner
   deletes it. */

type ListState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; items: SubmissionSummary[]; next: string | null; counts: SubmissionCounts; canReply: boolean; more: "idle" | "loading" | "failed" };

const when = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const FORM_OPTIONS = [{ value: "", label: "All forms" }, ...Object.entries(FORM_LABELS).map(([value, label]) => ({ value, label }))];
const STATUS_OPTIONS = [
  { value: "", label: "New and read" },
  { value: "new", label: "New only" },
  { value: "read", label: "Read only" },
];

export default function SubmissionsPage(_: PageProps) {
  const canWrite = useCan("submissions:write");
  const { toast } = useToast();
  const [filters, setFilters] = useState<SubmissionFilters>(NO_FILTERS);
  const [search, setSearch] = useState("");
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [open, setOpen] = useState<{ id: string; item: Submission | null; failed?: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);

  /* The text search waits for a pause in typing. */
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search })), 300);
    return () => clearTimeout(t);
  }, [search]);

  const generation = useRef(0);
  const load = useCallback(async (current: SubmissionFilters) => {
    const mine = ++generation.current;
    setList({ status: "loading" });
    try {
      const page = await submissionsApi.list(current);
      if (mine === generation.current) setList({ status: "ready", items: page.items, next: page.next, counts: page.counts, canReply: page.canReply, more: "idle" });
    } catch {
      if (mine === generation.current) setList({ status: "failed" });
    }
  }, []);
  const reversed = Boolean(filters.from && filters.to && filters.from > filters.to);
  useEffect(() => {
    if (!reversed) void load(filters);
  }, [load, filters, reversed]);

  async function loadMore() {
    if (list.status !== "ready" || !list.next) return;
    const mine = generation.current;
    const before = list.next;
    setList({ ...list, more: "loading" });
    try {
      const page = await submissionsApi.list(filters, before);
      if (mine === generation.current) setList((s) => (s.status === "ready" ? { ...s, items: [...s.items, ...page.items], next: page.next, counts: page.counts, more: "idle" } : s));
    } catch {
      if (mine === generation.current) setList((s) => (s.status === "ready" ? { ...s, more: "failed" } : s));
    }
  }

  /* A changed row, in place (status), without reloading the list. */
  const patch = (item: Submission) =>
    setList((s) => {
      if (s.status !== "ready") return s;
      const before = s.items.find((i) => i.id === item.id);
      const delta = before && before.status !== item.status ? (item.status === "new" ? 1 : -1) : 0;
      const form = s.counts.byForm[item.formId];
      return {
        ...s,
        items: s.items.map((i) => (i.id === item.id ? { ...i, status: item.status, replied: Boolean(item.replies?.length) } : i)),
        counts: { ...s.counts, new: s.counts.new + delta, byForm: form ? { ...s.counts.byForm, [item.formId]: { ...form, new: form.new + delta } } : s.counts.byForm },
      };
    });

  async function show(id: string) {
    setOpen({ id, item: null });
    setDraft("");
    setReplyError(null);
    try {
      let item = await submissionsApi.get(id);
      if (item.status === "new" && canWrite) {
        item = await submissionsApi.setStatus(id, "read");
        patch(item);
      }
      setOpen((o) => (o?.id === id ? { id, item } : o));
    } catch {
      setOpen((o) => (o?.id === id ? { id, item: null, failed: true } : o));
    }
  }

  async function markUnread(item: Submission) {
    setBusy(true);
    try {
      const saved = await submissionsApi.setStatus(item.id, "new");
      patch(saved);
      setOpen(null);
      toast({ title: "Marked as new" });
    } catch (caught) {
      toast({ title: caught instanceof ApiRequestError ? caught.message : "It could not be changed.", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(item: Submission) {
    setBusy(true);
    setReplyError(null);
    try {
      const saved = await submissionsApi.reply(item.id, draft);
      patch(saved);
      setOpen({ id: item.id, item: saved });
      setDraft("");
      toast({ title: "Reply sent", description: `Emailed to ${item.fields.email}.`, tone: "success" });
    } catch (caught) {
      setReplyError(caught instanceof ApiRequestError ? (caught.details[0]?.message ? `Message ${caught.details[0].message}.` : caught.message) : "The reply could not be sent. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Submission) {
    setBusy(true);
    try {
      await submissionsApi.remove(item.id);
      setConfirmDelete(false);
      setOpen(null);
      toast({ title: "Submission deleted", tone: "success" });
      void load(filters);
    } catch (caught) {
      toast({ title: caught instanceof ApiRequestError ? caught.message : "It could not be deleted.", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof SubmissionFilters) => (e: { target: { value: string } }) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const filtered = Boolean(filters.form || filters.status || filters.from || filters.to || filters.q);
  const counts = list.status === "ready" ? list.counts : null;
  const item = open?.item ?? null;
  const canReply = list.status === "ready" && list.canReply;

  return (
    <PageContainer>
      <PageHeader
        title="Form submissions"
        description="What visitors send through the website's Contact Us, Volunteer and Partner With Us forms. Newest first; kept until you delete them. Only owners can see this page."
      />
      {counts && (
        <div className={styles.counts} aria-label="Totals">
          <Badge tone={counts.new ? "info" : "neutral"}>{counts.new} new</Badge>
          {Object.entries(FORM_LABELS).map(([id, label]) => (
            <Badge key={id} tone="neutral">
              {label}: {counts.byForm[id]?.total ?? 0}
              {counts.byForm[id]?.new ? ` (${counts.byForm[id]!.new} new)` : ""}
            </Badge>
          ))}
        </div>
      )}
      <div className={styles.toolbar} role="search" aria-label="Filter the submissions">
        <Input type="search" aria-label="Search name, email, organisation or message" placeholder="Search name, email, organisation or message" leadingIcon={<Search />} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select aria-label="Form" options={FORM_OPTIONS} value={filters.form} onChange={set("form")} />
        <Select aria-label="Status" options={STATUS_OPTIONS} value={filters.status} onChange={set("status")} />
        <Input type="date" aria-label="From" value={filters.from} max={filters.to || undefined} onChange={set("from")} />
        <Input type="date" aria-label="To" value={filters.to} min={filters.from || undefined} onChange={set("to")} />
        <Button
          disabled={!filtered && !search}
          onClick={() => {
            setSearch("");
            setFilters(NO_FILTERS);
          }}
        >
          Clear
        </Button>
      </div>
      {reversed && (
        <Alert tone="warning" role="alert">
          The end date is before the start date.
        </Alert>
      )}
      {list.status === "failed" ? (
        <EmptyState bordered icon={Inbox} title="The submissions could not be loaded" description="Try again in a moment." actions={<Button onClick={() => load(filters)}>Try again</Button>} />
      ) : (
        <>
          <Table label="Form submissions" loading={list.status === "loading"}>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Form</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.status === "loading" ? (
                <TableLoading colSpan={5} />
              ) : list.items.length === 0 ? (
                filtered ? (
                  <TableEmpty colSpan={5} icon={Search} title="No submissions match" description="Try another filter, date range or search." />
                ) : (
                  <TableEmpty colSpan={5} icon={Inbox} title="No submissions yet" description="Messages sent through the website's forms appear here." />
                )
              ) : (
                list.items.map((s) => (
                  <TableRow key={s.id} data-submission-id={s.id}>
                    <TableCell muted>
                      <time dateTime={s.createdAt}>{when.format(new Date(s.createdAt))}</time>
                    </TableCell>
                    <TableCell>
                      {formLabel(s.formId)}
                      {s.topic && <span className={styles.sub}>{topicLabel(s.topic)}</span>}
                    </TableCell>
                    <TableCell>
                      <button type="button" className={`${styles.rowButton} ${s.status === "new" ? styles.new : ""}`} onClick={() => show(s.id)}>
                        {s.name || s.email}
                      </button>
                      <span className={styles.sub}>{s.email}</span>
                      {s.organization && <span className={styles.sub}>{s.organization}</span>}
                    </TableCell>
                    <TableCell muted>
                      <span className={styles.preview}>{s.preview || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge tone={s.status === "new" ? "info" : "neutral"}>{s.status === "new" ? "New" : "Read"}</Badge>
                      {s.replied && (
                        <span className={styles.sub}>
                          <Badge tone="success">Replied</Badge>
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {list.status === "ready" && (list.next || list.more === "failed") && (
            <div className={styles.more}>
              {list.more === "failed" && (
                <Alert tone="danger" role="alert">
                  The next submissions could not be loaded.
                </Alert>
              )}
              <Button loading={list.more === "loading"} onClick={loadMore}>
                {list.more === "failed" ? "Try again" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog
        open={Boolean(open) && !confirmDelete}
        onClose={() => setOpen(null)}
        size="lg"
        title={item ? `${formLabel(item.formId)} — ${item.fields.name ?? item.fields.email ?? ""}` : "Submission"}
        description={item ? `Received ${when.format(new Date(item.createdAt))} · reference ${item.reference}` : undefined}
        footer={
          item ? (
            <>
              <Button onClick={() => setOpen(null)}>Close</Button>
              {item.fields.email && (
                <Button leadingIcon={<ExternalLink />} onClick={() => (window.location.href = replyHref(item.fields.email!, item.formId, item.reference))}>
                  Open in mail app
                </Button>
              )}
              {canWrite && (
                <Button disabled={busy} onClick={() => markUnread(item)}>
                  Mark as new
                </Button>
              )}
              {canWrite && (
                <Button variant="destructive" leadingIcon={<Trash2 />} disabled={busy} onClick={() => setConfirmDelete(true)}>
                  Delete
                </Button>
              )}
            </>
          ) : (
            <Button onClick={() => setOpen(null)}>Close</Button>
          )
        }
      >
        {open && !item && !open.failed && <Spinner label="Loading the submission" />}
        {open?.failed && <Alert tone="danger">This submission could not be loaded. It may have been deleted.</Alert>}
        {item && (
          <dl className={styles.facts}>
            {fieldRows(item.fields).map((row) => (
              <div key={row.key}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {item && (item.replies?.length ?? 0) > 0 && (
          <section className={styles.replies} aria-label="Replies sent">
            <h3 className={styles.repliesHeading}>Replies sent</h3>
            <ol className={styles.replyList}>
              {item.replies!.map((r) => (
                <li key={r.id} className={styles.reply}>
                  <p className={styles.meta}>
                    {r.by.name} · {when.format(new Date(r.at))}
                  </p>
                  <p className={styles.replyText}>{r.message}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
        {item && canWrite && item.fields.email && (
          <section className={styles.replies} aria-label="Reply">
            {canReply ? (
              <>
                <FormField label={`Reply to ${item.fields.name || item.fields.email}`} helper={`Sent from Rising Beyond Borders to ${item.fields.email}, signed with your name. Their answer comes back to RBB's inbox for this form. Their message is not quoted.`} error={replyError ?? undefined}>
                  <Textarea rows={6} maxLength={5000} value={draft} onChange={(e) => setDraft(e.target.value)} />
                </FormField>
                <div>
                  <Button variant="primary" loading={busy} disabled={!draft.trim()} onClick={() => sendReply(item)}>
                    Send reply
                  </Button>
                </div>
              </>
            ) : (
              <Alert tone="info">Email is not set up for the website forms, so replies cannot be sent from here yet. Use “Open in mail app”.</Alert>
            )}
          </section>
        )}
      </Dialog>
      <Dialog
        open={confirmDelete && Boolean(item)}
        onClose={() => setConfirmDelete(false)}
        size="sm"
        title="Delete this submission?"
        description="It is deleted for good: it cannot be brought back."
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" loading={busy} onClick={() => item && remove(item)}>
              Delete
            </Button>
          </>
        }
      />
    </PageContainer>
  );
}
