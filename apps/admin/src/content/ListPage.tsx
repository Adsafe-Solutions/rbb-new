import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useCan } from "../auth";
import {
  Alert,
  Archive,
  Button,
  Card,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  EmptyState,
  IconButton,
  Input,
  Menu,
  MenuItem,
  PageContainer,
  PageHeader,
  Pencil,
  Plus,
  Search,
  Select,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableLoading,
  TableRow,
  useToast,
  type IconComponent,
  type SelectOption,
} from "../design-system";
import { navigate } from "../router";
import { publishApi, type PublishStatus } from "../settings/client";
import { PublishPanel } from "../pages/settings/PublishPanel";
import type { ContentStatus, ContentView, ListParams, contentApi } from "./client";
import { statusBadge } from "./editor";
import styles from "./content.module.css";

/* The list of a content collection: real records only, a page at a time
   from the API, with search, status/type filters and sorting — and the
   publish panel, so an owner can put saved changes live from here. */

export interface Column<R> {
  label: string;
  cell: (view: ContentView<R>) => ReactNode;
  align?: "start" | "end";
}

interface ListPageProps<R extends { id: string; title: string; status: ContentStatus }> {
  api: ReturnType<typeof contentApi<R>>;
  base: string;
  kind: string;
  plural: string;
  description: string;
  icon: IconComponent;
  emptyDescription: string;
  columns: Column<R>[];
  types?: SelectOption[];
  /* Status in its own column instead of under the title. */
  statusColumn?: boolean;
  /* What "By date" sorts by, when it is not the record's own date. */
  dateSortLabel?: string;
}

const STATUSES: SelectOption[] = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Needs review" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export function ContentListPage<R extends { id: string; title: string; status: ContentStatus }>({ api, base, kind, plural, description, icon, emptyDescription, columns: given, types, statusColumn = false, dateSortLabel = "By date" }: ListPageProps<R>) {
  const columns: Column<R>[] = statusColumn ? [{ label: "Status", cell: (v) => statusBadge(v.record.status, v.live, v.schedule) }, ...given] : given;
  const canCreate = useCan("content:create");
  const canArchive = useCan("content:delete");
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState<NonNullable<ListParams["sort"]>>("updated");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ready"; items: ContentView<R>[]; total: number; totalPages: number }>({ status: "loading" });
  const [publish, setPublish] = useState<PublishStatus | null>(null);
  const [reloads, setReloads] = useState(0);
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(search.trim()), 250);
    return () => window.clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(1), [query, status, type, sort]);
  useEffect(() => {
    let live = true;
    setState((s) => (s.status === "ready" ? s : { status: "loading" }));
    api
      .list({ search: query || undefined, status: (status || undefined) as ContentStatus | undefined, type: type || undefined, sort, page })
      .then((r) => live && setState({ status: "ready", items: r.items, total: r.pagination.total, totalPages: r.pagination.totalPages }), () => live && setState({ status: "error" }));
    publishApi.status().then((s) => live && setPublish(s), () => {});
    return () => {
      live = false;
    };
  }, [api, query, status, type, sort, page, reloads]);

  const archive = async (view: ContentView<R>) => {
    try {
      await api.archive(view.record.id);
      toast({ title: `“${view.record.title}” archived`, description: "It will not appear on the website after the next publish." });
      reload();
    } catch {
      toast({ title: `The ${kind} could not be archived`, tone: "danger" });
    }
  };

  const create = canCreate && (
    <Button variant="primary" leadingIcon={<Plus />} onClick={() => navigate(`/${base}/new`)}>
      New {kind}
    </Button>
  );
  const Icon = icon;
  const filtered = Boolean(query || status || type);

  return (
    <PageContainer>
      <PageHeader title={plural} description={description} actions={create} />
      {publish?.settingsReady && (
        <div className={styles.publish}>
          <PublishPanel status={publish} unsaved={false} onPublished={reload} />
        </div>
      )}
      <div className={styles.toolbar} role="search" aria-label={plural}>
        <Input type="search" aria-label="Search by title" placeholder="Search by title" leadingIcon={<Search />} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select aria-label="Status" options={STATUSES} value={status} onChange={(e) => setStatus(e.target.value)} />
        {types ? <Select aria-label="Type" options={[{ value: "", label: "All types" }, ...types]} value={type} onChange={(e) => setType(e.target.value)} /> : <span />}
        <Select
          aria-label="Sort"
          options={[
            { value: "updated", label: "Recently edited" },
            { value: "date", label: dateSortLabel },
            { value: "title", label: "By title" },
          ]}
          value={sort}
          onChange={(e) => setSort(e.target.value as NonNullable<ListParams["sort"]>)}
        />
      </div>
      {state.status === "error" && (
        <Alert tone="danger" role="alert">
          The {plural.toLowerCase()} could not be loaded.{" "}
          <Button size="sm" onClick={reload}>
            Try again
          </Button>
        </Alert>
      )}
      {state.status === "ready" && state.total === 0 && !filtered ? (
        <Card>
          <EmptyState icon={Icon} title={`No ${plural.toLowerCase()} yet`} description={emptyDescription} actions={create} />
        </Card>
      ) : (
        state.status !== "error" && (
          <Table label={plural} loading={state.status === "loading"}>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                {columns.map((c) => (
                  <TableHead key={c.label} align={c.align}>
                    {c.label}
                  </TableHead>
                ))}
                <TableHead shrink>
                  <span className="ds-visually-hidden">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.status === "loading" ? (
                <TableLoading colSpan={columns.length + 2} />
              ) : state.items.length === 0 ? (
                <TableEmpty colSpan={columns.length + 2} icon={Search} title={`No ${plural.toLowerCase()} match`} description="Try another title or filter." />
              ) : (
                state.items.map((view) => (
                  <TableRow key={view.record.id} data-content-id={view.record.id}>
                    <TableCell>
                      <button type="button" className={styles.titleLink} onClick={() => navigate(`/${base}/${view.record.id}`)}>
                        {view.record.title}
                      </button>
                      {!statusColumn && <span className={styles.sub}>{statusBadge(view.record.status, view.live, view.schedule)}</span>}
                    </TableCell>
                    {columns.map((c) => (
                      <TableCell key={c.label} align={c.align} muted>
                        {c.cell(view)}
                      </TableCell>
                    ))}
                    <TableCell shrink>
                      <Menu align="end" trigger={(props) => <IconButton {...props} size="sm" label={`Actions for ${view.record.title}`} icon={<Ellipsis />} />}>
                        <MenuItem icon={<Pencil />} onSelect={() => navigate(`/${base}/${view.record.id}`)}>
                          Edit
                        </MenuItem>
                        {canArchive && view.record.status !== "archived" && (
                          <MenuItem icon={<Archive />} destructive onSelect={() => archive(view)}>
                            Archive
                          </MenuItem>
                        )}
                      </Menu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )
      )}
      {state.status === "ready" && state.totalPages > 1 && (
        <nav className={styles.pagination} aria-label={`${plural} pages`}>
          <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} leadingIcon={<ChevronLeft />}>
            Previous
          </Button>
          <span className={styles.muted}>
            Page {page} of {state.totalPages} · {state.total} {plural.toLowerCase()}
          </span>
          <Button disabled={page >= state.totalPages} onClick={() => setPage((p) => p + 1)} trailingIcon={<ChevronRight />}>
            Next
          </Button>
        </nav>
      )}
    </PageContainer>
  );
}
