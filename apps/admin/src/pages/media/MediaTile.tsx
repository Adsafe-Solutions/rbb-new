import { useState } from "react";
import type { MediaItem } from "../../media/client";
import { formatBytes, type UploadItem } from "../../media/uploads";
import { Badge, CircleX, Image as ImageIcon, StatusBadge, TriangleAlert, cx } from "../../design-system";
import styles from "./MediaLibraryPage.module.css";

export const typeLabel = (mimeType: string) => ({ "image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WebP", "image/avif": "AVIF" })[mimeType] ?? mimeType;

/* One item in the grid: a button that opens its details. The thumbnail
   is the public file itself (no resizing service yet), so it is
   lazy-loaded and drawn into a fixed 4:3 box — no layout shift. */
export function MediaTile({ media, upload, onOpen }: { media: MediaItem; upload: UploadItem | undefined; onOpen: (media: MediaItem) => void }) {
  const [broken, setBroken] = useState(false);
  const uploading = media.status === "pending" && upload && ["preparing", "uploading", "completing"].includes(upload.phase);
  return (
    <li>
      <button type="button" className={styles.tile} onClick={() => onOpen(media)} data-media-id={media.id} data-status={media.status}>
        <span className={cx(styles.thumb, media.status !== "ready" && styles.thumbState)}>
          {media.status === "ready" && media.publicUrl && !broken ? (
            <img src={media.publicUrl} alt="" loading="lazy" decoding="async" width={media.width ?? undefined} height={media.height ?? undefined} onError={() => setBroken(true)} />
          ) : media.status === "failed" ? (
            <span className={styles.stateLabel}>
              <CircleX size={20} />
              Upload failed
            </span>
          ) : media.status === "pending" ? (
            uploading ? (
              <span className={styles.stateLabel}>
                <span className={styles.progressTrack} aria-hidden="true">
                  <span className={styles.progressBar} style={{ width: `${Math.round((upload?.progress ?? 0) * 100)}%` }} />
                </span>
                {upload?.phase === "completing" ? "Finishing…" : `Uploading ${Math.round((upload?.progress ?? 0) * 100)}%`}
              </span>
            ) : (
              <span className={styles.stateLabel}>
                <TriangleAlert size={20} />
                Upload not finished
              </span>
            )
          ) : (
            <span className={styles.stateLabel}>
              <ImageIcon size={20} />
              Preview unavailable
            </span>
          )}
        </span>
        <span className={styles.meta}>
          <span className={styles.name} title={media.originalFilename}>
            {media.originalFilename}
          </span>
          <span className={styles.sub}>
            {typeLabel(media.mimeType)} · {formatBytes(media.size)}
          </span>
        </span>
        <span className={styles.badges}>
          {media.status !== "ready" && <StatusBadge size="sm" status={media.status === "failed" ? "error" : "pending"} label={media.status === "failed" ? "Failed" : "Pending"} />}
          {media.status === "ready" && !media.alt && (
            <Badge size="sm" tone="warning" icon={<TriangleAlert />}>
              Alt text missing
            </Badge>
          )}
        </span>
      </button>
    </li>
  );
}
