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
   every field, marks it read, and offers a reply in the member's own mail
   program. Kept until an owner deletes it. */

type ListState =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; items: SubmissionSummary[]; next: string | null; counts: SubmissionCounts; more: "idle" | "loading" | "failed" };

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
      if (mine === generation.current) setList({ status: "ready", items: page.items, next: page.next, counts: page.counts, more: "idle" });
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
        items: s.items.map((i) => (i.id === item.id ? { ...i, status: item.status } : i)),
        counts: { ...s.counts, new: s.counts.new + delta, byForm: form ? { ...s.counts.byForm, [item.formId]: { ...form, new: form.new + delta } } : s.counts.byForm },
      };
    });

  async function show(id: string) {
    setOpen({ id, item: null });
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
                  Reply by email
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
