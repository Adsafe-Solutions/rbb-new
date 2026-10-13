import { useCallback, useEffect, useRef, useState } from "react";
import { ApiRequestError } from "../../api";
import { Alert, Badge, Button, EmptyState, Input, PageContainer, PageHeader, Search, Select, Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableLoading, TableRow, Users, useToast } from "../../design-system";
import type { PageProps } from "../../routes";
import { audienceApi, NO_AUDIENCE_FILTERS, type AudienceFilters, type AudienceMember } from "../../audience/client";
import { FORM_LABELS, formLabel } from "../../submissions/format";
import styles from "../submissions/submissions.module.css";

/* /audience — every unique person who sent a website form (by email),
   owners only. Their name, the forms they used, how often, first and last
   contact, and their LATEST answer to the marketing emails checkbox —
   the column to filter on before sending news. Read from the stored
   submissions: deleting someone's submissions removes them here too.
   Export: CSV of what the filters show. */

const day = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const MARKETING_OPTIONS = [
  { value: "", label: "Marketing: everyone" },
  { value: "yes", label: "Marketing emails: Yes" },
  { value: "no", label: "Marketing emails: No" },
  { value: "unknown", label: "Marketing emails: not asked" },
];

type State = { status: "loading" } | { status: "failed" } | { status: "ready"; items: AudienceMember[]; total: number; matching: number; optedIn: number; page: number; pages: number; more: boolean };

export default function AudiencePage(_: PageProps) {
  const { toast } = useToast();
  const [filters, setFilters] = useState<AudienceFilters>(NO_AUDIENCE_FILTERS);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<State>({ status: "loading" });
  const [exporting, setExporting] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === search ? f : { ...f, q: search })), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (f: AudienceFilters) => {
    const mine = ++generation.current;
    setState({ status: "loading" });
    try {
      const page = await audienceApi.list(f);
      if (mine === generation.current) setState({ status: "ready", ...page, more: false });
    } catch {
      if (mine === generation.current) setState({ status: "failed" });
    }
  }, []);
  useEffect(() => void load(filters), [load, filters]);

  async function loadMore() {
    if (state.status !== "ready" || state.page >= state.pages) return;
    const mine = generation.current;
    setState({ ...state, more: true });
    try {
      const next = await audienceApi.list(filters, state.page + 1);
      if (mine === generation.current) setState((s) => (s.status === "ready" ? { ...s, ...next, items: [...s.items, ...next.items], more: false } : s));
    } catch {
      if (mine === generation.current) setState((s) => (s.status === "ready" ? { ...s, more: false } : s));
      toast({ title: "More people could not be loaded.", tone: "danger" });
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const { blob, name } = await audienceApi.exportCsv(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name ?? "rbb-audience.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      toast({ title: caught instanceof ApiRequestError ? caught.message : "The export failed.", tone: "danger" });
    } finally {
      setExporting(false);
    }
  }

  const set = (key: keyof AudienceFilters) => (e: { target: { value: string } }) => setFilters((f) => ({ ...f, [key]: e.target.value }) as AudienceFilters);
  const filtered = Boolean(filters.q || filters.marketing || filters.form);
  const formOptions = [{ value: "", label: "All forms" }, ...Object.entries(FORM_LABELS).map(([value, label]) => ({ value, label }))];

  return (
    <PageContainer>
      <PageHeader
        title="Audience"
        description="Everyone who has sent a website form, one row per email address, with their latest answer to the marketing emails checkbox. Only owners can see this page."
        actions={
          <Button loading={exporting} disabled={state.status !== "ready" || state.matching === 0} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />
      {state.status === "ready" && (
        <div className={styles.counts} aria-label="Totals">
          <Badge tone="neutral">{state.total} people</Badge>
          <Badge tone="success">{state.optedIn} said yes to marketing emails</Badge>
          {filtered && <Badge tone="info">{state.matching} match the filters</Badge>}
        </div>
      )}
      <Alert tone="info" className={styles.notice}>
        The marketing checkbox is ticked by default on the forms. A pre-ticked box is generally not valid consent for marketing emails under UK/EU or Indian law — check with RBB before emailing the “Yes” list.
      </Alert>
      <div className={styles.toolbar} role="search" aria-label="Filter the audience">
        <Input type="search" aria-label="Search name or email" placeholder="Search name or email" leadingIcon={<Search />} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select aria-label="Marketing emails" options={MARKETING_OPTIONS} value={filters.marketing} onChange={set("marketing")} />
        <Select aria-label="Form" options={formOptions} value={filters.form} onChange={set("form")} />
        <Button
          disabled={!filtered && !search}
          onClick={() => {
            setSearch("");
            setFilters(NO_AUDIENCE_FILTERS);
          }}
        >
          Clear
        </Button>
      </div>
      {state.status === "failed" ? (
        <EmptyState bordered icon={Users} title="The audience could not be loaded" description="Try again in a moment." actions={<Button onClick={() => load(filters)}>Try again</Button>} />
      ) : (
        <>
          <Table label="Audience" loading={state.status === "loading"}>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Forms</TableHead>
                <TableHead align="end">Submissions</TableHead>
                <TableHead>First contact</TableHead>
                <TableHead>Last contact</TableHead>
                <TableHead>Marketing emails</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.status === "loading" ? (
                <TableLoading colSpan={6} />
              ) : state.items.length === 0 ? (
                <TableEmpty colSpan={6} icon={filtered ? Search : Users} title={filtered ? "Nobody matches" : "No one yet"} description={filtered ? "Try another search or filter." : "People appear here as they send the website's forms."} />
              ) : (
                state.items.map((p) => (
                  <TableRow key={p.email.toLowerCase()}>
                    <TableCell>
                      {p.name || p.email}
                      <span className={styles.sub}>{p.email}</span>
                    </TableCell>
                    <TableCell muted>{p.forms.map((f) => formLabel(f)).join(", ")}</TableCell>
                    <TableCell align="end">{p.submissions}</TableCell>
                    <TableCell muted>{day.format(new Date(p.firstAt))}</TableCell>
                    <TableCell muted>{day.format(new Date(p.lastAt))}</TableCell>
                    <TableCell>
                      {p.marketing === "Yes" ? <Badge tone="success">Yes</Badge> : p.marketing === "No" ? <Badge tone="neutral">No</Badge> : <span className={styles.sub}>Not asked</span>}
                      {p.marketingAt && <span className={styles.sub}>since {day.format(new Date(p.marketingAt))}</span>}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {state.status === "ready" && state.page < state.pages && (
            <div className={styles.more}>
              <Button loading={state.more} onClick={loadMore}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
