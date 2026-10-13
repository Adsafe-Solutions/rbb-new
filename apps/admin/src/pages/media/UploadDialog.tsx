import { useRef, useState, type DragEvent } from "react";
import { Button, CircleCheck, CircleX, Dialog, IconButton, Spinner, X, cx } from "../../design-system";
import type { MediaPolicy } from "../../media/client";
import { MAX_EDGE } from "../../media/convert";
import { formatBytes, type UploadItem } from "../../media/uploads";
import styles from "./MediaLibraryPage.module.css";

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  policy: MediaPolicy | null;
  uploads: UploadItem[];
  onAdd: (files: File[]) => void;
  onCancel: (key: string) => void;
  onRetry: (key: string) => void;
  onDismiss: (key: string) => void;
  onClearFinished: () => void;
}

/* Choose or drop images; each uploads straight to storage with its own
   progress, cancel and retry. Closing the dialog does not stop uploads —
   they keep going and show in the grid. */
export function UploadDialog({ open, onClose, policy, uploads, onAdd, onCancel, onRetry, onDismiss, onClearFinished }: UploadDialogProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  /* Any image: each is converted to WebP before it uploads (media/convert.ts). */
  const accept = "image/*";

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) onAdd([...event.dataTransfer.files]);
  };
  const finished = uploads.some((u) => ["done", "failed", "cancelled"].includes(u.phase));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title="Upload media"
      description={
        policy
          ? `Any image — JPEG, PNG, WebP, AVIF, GIF… Each is converted to WebP and scaled to at most ${MAX_EDGE} px on its longest side before it uploads, so it is smaller with no visible loss of quality.`
          : "Loading upload limits…"
      }
      footer={
        <>
          {finished && (
            <Button variant="ghost" onClick={onClearFinished}>
              Clear finished
            </Button>
          )}
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <div
        className={cx(styles.dropzone, dragging && styles.dropzoneActive)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        data-testid="upload-dropzone"
      >
        <p className={styles.dropTitle}>Drag images here</p>
        <p className={styles.dropHint}>or</p>
        <Button variant="primary" onClick={() => input.current?.click()} disabled={!policy}>
          Choose files
        </Button>
        <input
          ref={input}
          type="file"
          accept={accept}
          multiple
          hidden
          aria-label="Choose image files"
          data-testid="upload-input"
          onChange={(event) => {
            if (event.target.files?.length) onAdd([...event.target.files]);
            event.target.value = "";
          }}
        />
      </div>
      {uploads.length > 0 && (
        <ul className={styles.queue} aria-label="Uploads">
          {uploads.map((u) => (
            <li key={u.key} className={styles.queueItem} data-phase={u.phase}>
              <span className={styles.queueIcon} aria-hidden="true">
                {u.phase === "done" ? <CircleCheck size={16} /> : u.phase === "failed" ? <CircleX size={16} /> : u.phase === "cancelled" ? <X size={16} /> : <Spinner size="sm" label={null} />}
              </span>
              <span className={styles.queueText}>
                <span className={styles.queueName}>{u.file.name}</span>
                <span className={styles.queueStatus} role={u.phase === "failed" ? "alert" : undefined}>
                  {u.phase === "queued" && "Waiting…"}
                  {u.phase === "optimising" && "Optimising…"}
                  {u.phase === "preparing" && "Preparing…"}
                  {u.phase === "uploading" && `Uploading · ${Math.round(u.progress * 100)}% of ${formatBytes(u.optimised?.to ?? u.file.size)}`}
                  {u.phase === "completing" && "Checking the file…"}
                  {u.phase === "done" && (u.optimised?.converted ? `Uploaded as WebP · ${formatBytes(u.optimised.from)} → ${formatBytes(u.optimised.to)}` : "Uploaded")}
                  {u.phase === "cancelled" && "Cancelled"}
                  {u.phase === "failed" && u.error}
                </span>
                {u.phase === "uploading" && (
                  <span className={styles.progressTrack} role="progressbar" aria-label={`Uploading ${u.file.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(u.progress * 100)}>
                    <span className={styles.progressBar} style={{ width: `${Math.round(u.progress * 100)}%` }} />
                  </span>
                )}
              </span>
              <span className={styles.queueActions}>
                {["optimising", "preparing", "uploading"].includes(u.phase) && (
                  <Button size="sm" variant="ghost" onClick={() => onCancel(u.key)}>
                    Cancel
                  </Button>
                )}
                {(u.phase === "failed" || u.phase === "cancelled") && u.retryable && (
                  <Button size="sm" onClick={() => onRetry(u.key)}>
                    Retry
                  </Button>
                )}
                {["done", "failed", "cancelled"].includes(u.phase) && <IconButton size="sm" label={`Remove ${u.file.name} from this list`} icon={<X />} onClick={() => onDismiss(u.key)} />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
