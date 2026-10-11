/* What every block page (homepage, About) has in common in the editor:
   the block envelope, a new block's id, and the API's error paths mapped
   to blocks. */

export interface Block {
  id: string;
  type: string;
  enabled: boolean;
  version: 1;
  data: unknown;
}

export interface BlockInfo {
  type: string;
  label: string;
  description: string;
  single: boolean;
  first?: boolean;
}

/* A stable id for a new block: its kind and a short random part. */
export const newBlockId = (type: string) => `${type.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}-${crypto.randomUUID().slice(0, 8)}`;

/* The API's error paths ("body.changes.sections.3.data.heading") → per
   block id, so they stay attached to the right block after reordering. */
export function errorsByBlock(details: { path: string; message: string }[], sections: { id: string }[]) {
  const blocks = new Map<string, Map<string, string>>();
  const general: { path: string; message: string }[] = [];
  for (const d of details) {
    const path = d.path.replace(/^body\.(changes\.)?/, "");
    const m = /^sections\.(\d+)(?:\.(.*))?$/.exec(path);
    const id = m ? sections[Number(m[1])]?.id : undefined;
    if (!id) {
      general.push({ path, message: d.message });
      continue;
    }
    if (!blocks.has(id)) blocks.set(id, new Map());
    blocks.get(id)!.set((m![2] ?? "").replace(/^data\.?/, ""), d.message);
  }
  return { blocks, general };
}
