import type { MediaItem } from "./client";

/* Ready, and nothing uses it: safe to delete (2026-10-13). A ready image
   whose usage is unknown (an older API answer) is not offered. A failed
   or unfinished upload is never used, unless it is still uploading. The
   API decides in the end: it refuses (409) a file still in use. */
export const deletable = (media: Pick<MediaItem, "status" | "usedBy">, uploading = false) =>
  media.status === "ready" ? Array.isArray(media.usedBy) && media.usedBy.length === 0 : !uploading;
