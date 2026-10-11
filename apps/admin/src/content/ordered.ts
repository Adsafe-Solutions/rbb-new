import { useCallback, useEffect, useState } from "react";
import { ApiRequestError } from "../api";
import { useToast } from "../design-system";
import type { ContentStatus, ContentView } from "./client";

/* An ORDERED collection's list (the team, the programs): loaded whole and
   sorted by position, with Move up / Move down that save at once — the
   whole order with each record's revision, so a stale list is refused
   (a conflict to reload) rather than overwriting someone's edit. Focus
   follows the moved record (`data-ordered-id` on its row, `data-move` on
   its buttons). `peers` limits a move to records of the same group. */

interface OrderedRecord {
  id: string;
  order: number;
  status: ContentStatus;
}

interface OrderedApi<R> {
  list: (params: { pageSize: number; sort: "updated" }) => Promise<{ items: ContentView<R>[] }>;
  order: (items: { id: string; revision: number }[]) => Promise<ContentView<R>[]>;
}

const byOrder = <R extends OrderedRecord>(a: ContentView<R>, b: ContentView<R>) => a.record.order - b.record.order || a.record.id.localeCompare(b.record.id);

export function useOrderedCollection<R extends OrderedRecord>(api: OrderedApi<R>, nameOf: (record: R) => string, peers: (a: R, b: R) => boolean = () => true) {
  const { toast } = useToast();
  const [items, setItems] = useState<ContentView<R>[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  const load = useCallback(async () => {
    setConflict(null);
    try {
      const { items } = await api.list({ pageSize: 100, sort: "updated" });
      setItems([...items].sort(byOrder));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [api]);
  useEffect(() => void load(), [load]);

  const ordered = (items ?? []).filter((m) => m.record.status !== "archived");

  async function move(item: ContentView<R>, by: -1 | 1) {
    const group = ordered.filter((m) => peers(m.record, item.record));
    const at = group.findIndex((m) => m.record.id === item.record.id);
    const other = group[at + by];
    if (!other) return;
    const next = [...ordered];
    const i = next.indexOf(item);
    const j = next.indexOf(other);
    [next[i], next[j]] = [next[j]!, next[i]!];
    setBusy(true);
    try {
      const saved = await api.order(next.map((m) => ({ id: m.record.id, revision: m.revision })));
      const byId = new Map(saved.map((v) => [v.record.id, v]));
      setItems((list) => (list ?? []).map((m) => byId.get(m.record.id) ?? m).sort(byOrder));
      toast({ title: `“${nameOf(item.record)}” moved ${by < 0 ? "up" : "down"}`, tone: "success" });
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-ordered-id="${item.record.id}"] [data-move="${by < 0 ? "up" : "down"}"]`)?.focus());
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 409) setConflict(caught.message);
      else toast({ title: "The order could not be saved", tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  /* A record's place among its peers (for disabling Move up/down). */
  const position = (item: ContentView<R>) => {
    const group = ordered.filter((m) => peers(m.record, item.record));
    return { index: group.indexOf(item), count: group.length };
  };

  return { items, failed, busy, conflict, load, move, position, ordered };
}
