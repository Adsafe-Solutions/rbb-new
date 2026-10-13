import { useCallback, useEffect, useRef, useState } from "react";
import { mediaApi, putToStorage, uploadErrorMessage, type MediaItem, type MediaPolicy } from "./client";
import { optimiseImage } from "./convert";

/* The upload queue: each file goes
     optimise (convert.ts: WebP, scaled to the website's largest size)
     → check (here, for instant feedback) → intent (API) → PUT (storage)
     → complete (API verifies) → done
   A failure after the intent tells the API (abort), so no record is ever
   left looking ready. Retry starts over with a NEW intent — an object key
   is never reused. The checks here mirror the API's policy for speed only;
   the API decides. */

export type UploadPhase = "queued" | "optimising" | "preparing" | "uploading" | "completing" | "done" | "failed" | "cancelled";

export interface UploadItem {
  key: string;
  file: File;
  phase: UploadPhase;
  progress: number;
  error: string | null;
  /* False when the file itself is refused (type, size): retrying cannot help. */
  retryable: boolean;
  mediaId: string | null;
  media: MediaItem | null;
  /* What optimising did: the size before and after, and whether it became WebP. */
  optimised: { from: number; to: number; converted: boolean } | null;
}

const MAX_PARALLEL = 3;
const EXTENSION_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif" };

export const formatBytes = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;

/* The type to declare for a file, or a reason it cannot be uploaded. */
export function checkFile(file: File, policy: MediaPolicy): { mimeType: string } | { error: string } {
  const extension = /\.([A-Za-z0-9]+)$/.exec(file.name)?.[1]?.toLowerCase() ?? "";
  // Some browsers leave AVIF's type empty; fall back to the extension.
  const mimeType = policy.mimeTypes.includes(file.type) ? file.type : !file.type && policy.extensions.includes(extension) ? EXTENSION_TYPES[extension] ?? "" : "";
  if (!mimeType) return { error: "This file type isn't supported." };
  if (extension && EXTENSION_TYPES[extension] && EXTENSION_TYPES[extension] !== mimeType) return { error: "The file extension doesn't match its type." };
  if (file.size === 0) return { error: "This file is empty." };
  if (file.size > policy.maxBytes) return { error: `File exceeds the maximum allowed size (${formatBytes(policy.maxBytes)}).` };
  return { mimeType };
}

export function useUploads(policy: MediaPolicy | null, onUploaded: (media: MediaItem) => void) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const running = useRef(new Set<string>());
  const onUploadedRef = useRef(onUploaded);
  onUploadedRef.current = onUploaded;

  const patch = useCallback((key: string, changes: Partial<UploadItem>) => setItems((list) => list.map((item) => (item.key === key ? { ...item, ...changes } : item))), []);

  const run = useCallback(
    async (item: UploadItem, policy: MediaPolicy) => {
      const controller = new AbortController();
      controllers.current.set(item.key, controller);
      running.current.add(item.key);
      let mediaId: string | null = null;
      let stage: "prepare" | "upload" | "complete" = "prepare";
      /* Cancel can be pressed at any point before completing — including
         while the intent request is still out, which takes a real network
         round trip. Checked again once each awaited step returns, so a
         cancel is never lost; the catch tells the API (abort). */
      const stopIfCancelled = () => {
        if (controller.signal.aborted) throw new DOMException("Upload cancelled", "AbortError");
      };
      try {
        patch(item.key, { phase: "optimising", progress: 0, error: null, mediaId: null, media: null, optimised: null });
        const optimised = await optimiseImage(item.file);
        stopIfCancelled();
        const file = optimised.file;
        patch(item.key, { optimised: { from: optimised.originalSize, to: file.size, converted: optimised.converted } });
        const checked = checkFile(file, policy);
        if ("error" in checked) {
          patch(item.key, { phase: "failed", error: checked.error, retryable: false });
          return;
        }
        patch(item.key, { phase: "preparing" });
        const intent = await mediaApi.createIntent({ filename: file.name, mimeType: checked.mimeType, size: file.size });
        mediaId = intent.mediaId;
        stopIfCancelled();
        patch(item.key, { phase: "uploading", mediaId });
        stage = "upload";
        await putToStorage(intent, file, (progress) => patch(item.key, { progress }), controller.signal);
        stopIfCancelled();
        // The signed URL has done its job; it is not kept anywhere.
        stage = "complete";
        patch(item.key, { phase: "completing", progress: 1 });
        const media = await mediaApi.complete(intent.mediaId);
        patch(item.key, { phase: "done", media });
        onUploadedRef.current(media);
      } catch (error) {
        const cancelled = controller.signal.aborted;
        // Tell the API the upload will not finish (the complete stage has
        // already recorded its own failure).
        if (mediaId && stage !== "complete") await mediaApi.abort(mediaId).catch(() => {});
        const message = cancelled ? null : uploadErrorMessage(error, stage);
        const refused = message === "This file type isn't supported." || message === "File exceeds the maximum allowed size.";
        patch(item.key, { phase: cancelled ? "cancelled" : "failed", error: message, retryable: !refused });
      } finally {
        controllers.current.delete(item.key);
        running.current.delete(item.key);
      }
    },
    [patch]
  );

  // Start queued items, at most MAX_PARALLEL at a time.
  useEffect(() => {
    if (!policy) return;
    const slots = MAX_PARALLEL - running.current.size;
    if (slots <= 0) return;
    for (const item of items.filter((i) => i.phase === "queued").slice(0, slots)) {
      running.current.add(item.key); // counted at once, so the next pass does not start it twice
      void run(item, policy);
    }
  }, [items, policy, patch, run]);

  const add = useCallback((files: File[]) => {
    setItems((list) => [...list, ...files.map((file) => ({ key: crypto.randomUUID(), file, phase: "queued" as const, progress: 0, error: null, retryable: true, mediaId: null, media: null, optimised: null }))]);
  }, []);

  const cancel = useCallback((key: string) => controllers.current.get(key)?.abort(), []);
  const retry = useCallback((key: string) => patch(key, { phase: "queued", progress: 0, error: null }), [patch]);
  const dismiss = useCallback((key: string) => setItems((list) => list.filter((i) => i.key !== key)), []);
  const clearFinished = useCallback(() => setItems((list) => list.filter((i) => !["done", "failed", "cancelled"].includes(i.phase))), []);

  // Leaving the page cancels uploads still in flight.
  useEffect(() => () => controllers.current.forEach((c) => c.abort()), []);

  const active = items.some((i) => ["queued", "optimising", "preparing", "uploading", "completing"].includes(i.phase));
  return { items, add, cancel, retry, dismiss, clearFinished, active };
}
