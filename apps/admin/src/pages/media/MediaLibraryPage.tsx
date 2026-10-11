import { useCallback, useEffect, useMemo, useState } from "react";
import { useCan } from "../../auth";
import {
  Alert,
  Button,
  Card,
  ChevronLeft,
  ChevronRight,
  Drawer,
  EmptyState,
  Image as ImageIcon,
  Input,
  PageContainer,
  PageHeader,
  Plus,
  Search,
  Select,
  Skeleton,
} from "../../design-system";
import { mediaApi, type MediaItem, type MediaListParams, type MediaPolicy, type Pagination } from "../../media/client";
import { useUploads } from "../../media/uploads";
import { MediaDetail } from "./MediaDetail";
import { MediaTile } from "./MediaTile";
import { UploadDialog } from "./UploadDialog";
import styles from "./MediaLibraryPage.module.css";

/* The media library: every file the organization has uploaded, newest
   first, a page at a time from the API (nothing is loaded wholesale).
   Everything shown is a real record — an empty library says so. */

const PAGE_SIZE = 24;
const FILTERS = [
  { value: "all", label: "All media" },
  { value: "images", label: "Images" },
  { value: "ready", label: "Ready" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
] as const;
type Filter = (typeof FILTERS)[number]["value"];

const paramsFor = (filter: Filter): Pick<MediaListParams, "type" | "status"> =>
  filter === "images" ? { type: "image" } : filter === "ready" || filter === "pending" || filter === "failed" ? { status: filter } : {};

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

type ListState = { status: "loading" } | { status: "error" } | { status: "ready"; items: MediaItem[]; pagination: Pagination };

export default function MediaLibraryPage() {
  const canUpload = useCan("media:write");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [reloads, setReloads] = useState(0);
  const [policy, setPolicy] = useState<MediaPolicy | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const query = useDebounced(search.trim(), 250);

  const reload = useCallback(() => setReloads((n) => n + 1), []);
  const uploads = useUploads(policy, reload);

  useEffect(() => setPage(1), [query, filter, sort]);

  useEffect(() => {
    let current = true;
    setList((state) => (state.status === "ready" ? state : { status: "loading" }));
    mediaApi
      .list({ search: query || undefined, ...paramsFor(filter), sort, page, pageSize: PAGE_SIZE })
      .then((result) => current && setList({ status: "ready", ...result }))
      .catch(() => current && setList({ status: "error" }));
    return () => {
      current = false;
    };
  }, [query, filter, sort, page, reloads]);

  // A pending upload's tile follows its progress; refresh when one starts.
  const uploadsByMedia = useMemo(() => new Map(uploads.items.filter((u) => u.mediaId).map((u) => [u.mediaId!, u])), [uploads.items]);
  const startedIds = uploads.items.map((u) => u.mediaId).filter(Boolean).join();
  useEffect(() => {
    if (startedIds) reload();
  }, [startedIds, reload]);

  useEffect(() => {
    if (canUpload) mediaApi.policy().then(setPolicy, () => setPolicy(null));
  }, [canUpload]);

  const filtered = query !== "" || filter !== "all";
  const upload = canUpload && (
    <Button variant="primary" leadingIcon={<Plus />} onClick={() => setUploadOpen(true)}>
      Upload
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader title="Media" description="Manage images and media used across the website." actions={upload} />

      <div className={styles.toolbar} role="search" aria-label="Media">
        <div className={styles.search}>
          <Input type="search" aria-label="Search by file name" placeholder="Search by file name" leadingIcon={<Search />} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className={styles.filter}>
          <Select aria-label="Filter" options={FILTERS.map((f) => ({ value: f.value, label: f.label }))} value={filter} onChange={(e) => setFilter(e.target.value as Filter)} />
        </div>
        <div className={styles.sort}>
          <Select
            aria-label="Sort"
            options={[
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
            ]}
            value={sort}
            onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
          />
        </div>
      </div>

      {list.status === "error" && (
        <Alert tone="danger" role="alert" className={styles.listAlert}>
          The media library could not be loaded.{" "}
          <Button size="sm" onClick={reload}>
            Try again
          </Button>
        </Alert>
      )}

      {list.status === "loading" && (
        <ul className={styles.grid} aria-busy="true" aria-label="Loading media">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className={styles.skeletonTile} aria-hidden="true">
              <span className={styles.thumb} />
              <Skeleton width="70%" />
              <Skeleton width="40%" height={10} />
            </li>
          ))}
        </ul>
      )}

      {list.status === "ready" && list.items.length === 0 && (
        <Card>
          {filtered ? (
            <EmptyState icon={Search} title="No media matches" description="Try another file name, or show all media." actions={<Button onClick={() => (setSearch(""), setFilter("all"))}>Show all media</Button>} />
          ) : (
            <EmptyState icon={ImageIcon} title="Your media library is empty." description="Upload an image to start building your media library." actions={upload} />
          )}
        </Card>
      )}

      {list.status === "ready" && list.items.length > 0 && (
        <>
          <p className={styles.count} aria-live="polite">
            {list.pagination.total} {list.pagination.total === 1 ? "file" : "files"}
            {list.pagination.totalPages > 1 && ` · page ${list.pagination.page} of ${list.pagination.totalPages}`}
          </p>
          <ul className={styles.grid} aria-label="Media files">
            {list.items.map((media) => (
              <MediaTile key={media.id} media={media} upload={uploadsByMedia.get(media.id)} onOpen={setSelected} />
            ))}
          </ul>
          {list.pagination.totalPages > 1 && (
            <nav className={styles.pagination} aria-label="Media pages">
              <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} leadingIcon={<ChevronLeft />}>
                Previous
              </Button>
              <Button disabled={page >= list.pagination.totalPages} onClick={() => setPage((p) => p + 1)} trailingIcon={<ChevronRight />}>
                Next
              </Button>
            </nav>
          )}
        </>
      )}

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        policy={policy}
        uploads={uploads.items}
        onAdd={uploads.add}
        onCancel={uploads.cancel}
        onRetry={uploads.retry}
        onDismiss={uploads.dismiss}
        onClearFinished={uploads.clearFinished}
      />

      <Drawer open={selected !== null} onClose={() => setSelected(null)} label={selected ? `Details: ${selected.originalFilename}` : "Media details"} side="right" size="lg">
        {selected && (
          <MediaDetail
            media={selected}
            onClose={() => setSelected(null)}
            onChanged={(media) => {
              setSelected(media);
              setList((state) => (state.status === "ready" ? { ...state, items: state.items.map((m) => (m.id === media.id ? media : m)) } : state));
            }}
            onDeleted={() => {
              setSelected(null);
              reload();
            }}
          />
        )}
      </Drawer>
    </PageContainer>
  );
}

