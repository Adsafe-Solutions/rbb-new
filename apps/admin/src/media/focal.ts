/* Milestone 2: an image's focal point in the media library — the point to
   keep in frame when a page crops the image. Stored as "X% Y%" (whole
   percentages 0–100, horizontal then vertical: CSS object-position, the
   contract's FocalPoint); null means centred. Edited as two numbers, or
   by clicking the preview. Nothing is ever set automatically. */

export interface FocalDraft {
  x: string;
  y: string;
}

const PATTERN = /^(\d{1,3})% (\d{1,3})%$/;

/* The stored value → the two editable numbers ("" and "" when centred). */
export function focalDraft(focal: string | null | undefined): FocalDraft {
  const m = focal ? PATTERN.exec(focal) : null;
  return m && Number(m[1]) <= 100 && Number(m[2]) <= 100 ? { x: m[1]!, y: m[2]! } : { x: "", y: "" };
}

const percent = (text: string) => (/^\d{1,3}$/.test(text.trim()) && Number(text) <= 100 ? Number(text) : null);

/* The two numbers → the value to save, or why they cannot be saved. Both
   empty: centred (null). */
export function focalFromDraft(draft: FocalDraft): { value: string | null } | { problem: string } {
  const x = draft.x.trim();
  const y = draft.y.trim();
  if (!x && !y) return { value: null };
  if (!x || !y) return { problem: "Give both positions, or leave both empty to keep the image centred." };
  const px = percent(x);
  const py = percent(y);
  if (px === null || py === null) return { problem: "Each position is a whole number from 0 to 100." };
  return { value: `${px}% ${py}%` };
}

/* A click on the preview → the focal point there, in whole percentages. */
export function focalAt(point: { x: number; y: number }, box: { left: number; top: number; width: number; height: number }): FocalDraft {
  const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
  return { x: String(clamp(((point.x - box.left) / box.width) * 100)), y: String(clamp(((point.y - box.top) / box.height) * 100)) };
}
