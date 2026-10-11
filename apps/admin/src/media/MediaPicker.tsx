import { useEffect, useId, useState } from "react";
import { ApiRequestError } from "../api";
import { Button, Dialog, EmptyState, Image as ImageIcon, Input, Search, Spinner, TriangleAlert, cx } from "../design-system";
import { mediaApi, type MediaItem } from "./client";
import styles from "./MediaPicker.module.css";

/* Choose ONE ready image from the media library, by id. Settings (logo,
   favicon, share image) store the id, never a URL. It does not upload:
   new images are added in the Media Library. */

interface MediaPickerProps {
  label: string;
  helper?: string;
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  disabled?: boolean;
  /* Field-level error from the API (e.g. the image was deleted). */
  error?: string;
}

export function MediaPicker({ label, helper, value, onChange, disabled, error }: MediaPickerProps) {
  const labelId = useId();
  const [current, setCurrent] = useState<{ state: "none" } | { state: "loading" } | { state: "found"; media: MediaItem } | { state: "missing" }>({ state: "none" });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!value) return setCurrent({ state: "none" });
    let live = true;
    setCurrent({ state: "loading" });
    mediaApi.get(value).then(
      (media) => live && setCurrent(media.status === "ready" ? { state: "found", media } : { state: "missing" }),
      (e) => live && setCurrent(e instanceof ApiRequestError && e.status === 404 ? { state: "missing" } : { state: "none" })
    );
    return () => {
      live = false;
    };
  }, [value]);

  return (
    <div className={styles.field} role="group" aria-labelledby={labelId}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <div className={cx(styles.box, error && styles.invalid)}>
        <span className={styles.thumb}>
          {current.state === "found" && current.media.publicUrl ? <img src={current.media.publicUrl} alt="" /> : current.state === "loading" ? <Spinner size="sm" label={null} /> : <ImageIcon size={18} />}
        </span>
        <span className={styles.name}>
          {current.state === "found" ? current.media.originalFilename : current.state === "missing" ? "This image is no longer in the media library" : current.state === "loading" ? "Loading…" : "No image selected"}
        </span>
        {!disabled && (
          <span className={styles.actions}>
            <Button size="sm" onClick={() => setOpen(true)}>
              {value ? "Change" : "Choose image"}
            </Button>
            {value && (
              <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>
                Remove
              </Button>
            )}
          </span>
        )}
      </div>
      {current.state === "missing" && (
        <p className={styles.warning}>
          <TriangleAlert size={14} /> Choose another image, or remove this one, before publishing.
        </p>
      )}
      {error && <p className={styles.error}>{error}</p>}
      {helper && <p className={styles.helper}>{helper}</p>}
      <PickerDialog
        open={open}
        title={label}
        selected={value}
        onClose={() => setOpen(false)}
        onPick={(id) => {
          onChange(id);
          setOpen(false);
        }}
      />
    </div>
  );
}

function PickerDialog({ open, title, selected, onClose, onPick }: { open: boolean; title: string; selected: string | undefined; onClose: () => void; onPick: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ready"; items: MediaItem[] }>({ status: "loading" });

  useEffect(() => {
    if (!open) return;
    let live = true;
    const timer = window.setTimeout(() => {
      mediaApi
        .list({ status: "ready", type: "image", search: search.trim() || undefined, pageSize: 48 })
        .then((r) => live && setState({ status: "ready", items: r.items }), () => live && setState({ status: "error" }));
    }, 200);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [open, search]);

  return (
    <Dialog open={open} onClose={onClose} size="lg" title={`Choose: ${title}`} description="Ready images from the media library. Upload new images in Media." footer={<Button onClick={onClose}>Cancel</Button>}>
      <Input type="search" aria-label="Search images by file name" placeholder="Search by file name" leadingIcon={<Search />} value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className={styles.results}>
        {state.status === "loading" && <Spinner label="Loading images" />}
        {state.status === "error" && <p className={styles.error}>The media library could not be loaded.</p>}
        {state.status === "ready" && state.items.length === 0 && <EmptyState size="sm" as="h3" icon={ImageIcon} title="No ready images" description={search ? "No image matches that name." : "Upload images in the Media Library first."} />}
        {state.status === "ready" && state.items.length > 0 && (
          <ul className={styles.grid} aria-label="Images">
            {state.items.map((m) => (
              <li key={m.id}>
                <button type="button" className={cx(styles.option, m.id === selected && styles.selected)} aria-pressed={m.id === selected} onClick={() => onPick(m.id)} data-media-id={m.id}>
                  <span className={styles.optionThumb}>{m.publicUrl && <img src={m.publicUrl} alt="" loading="lazy" />}</span>
                  <span className={styles.optionName}>{m.originalFilename}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
