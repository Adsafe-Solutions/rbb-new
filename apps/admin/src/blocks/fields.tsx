import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Badge, Copy, Button, Checkbox, FormField, IconButton, Input, Plus, Spinner, Textarea, Trash2 } from "../design-system";
import { isReady, readinessWord } from "../content/workflow";
import { MediaPicker } from "../media/MediaPicker";
import { unlistedChoices, withoutChoice } from "./pickerChoices";
import styles from "./blocks.module.css";

/* The typed fields every block editor is built from. Each one edits one
   contract field; `error` is the API's message for exactly that field. */

type Err = (path: string) => string | undefined;

export function TextField({ label, value, onChange, max, required, helper, error, disabled, multiline }: { label: string; value: string | undefined; onChange: (v: string | undefined) => void; max: number; required?: boolean; helper?: string; error?: string; disabled: boolean; multiline?: boolean }) {
  return (
    <FormField label={label} required={required} helper={helper} error={error} disabled={disabled}>
      {multiline ? (
        <Textarea rows={3} maxLength={max} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" && !required ? undefined : e.target.value)} />
      ) : (
        <Input maxLength={max} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" && !required ? undefined : e.target.value)} />
      )}
    </FormField>
  );
}

/* Paragraphs: one per blank-line-separated block of text. */
export function ParagraphsField({ label, value, onChange, error, disabled, helper }: { label: string; value: string[]; onChange: (v: string[]) => void; error?: string; disabled: boolean; helper?: string }) {
  return (
    <FormField label={label} required helper={helper ?? "Separate paragraphs with a blank line."} error={error} disabled={disabled}>
      <Textarea rows={5} value={value.join("\n\n")} onChange={(e) => onChange(e.target.value.split(/\n{2,}/).map((p) => p.replace(/\n/g, " ")))} />
    </FormField>
  );
}

/* A button or link: its words and where it goes. */
export function LinkField({ label, value, onChange, error, disabled, optional }: { label: string; value: { label: string; href: string } | undefined; onChange: (v: { label: string; href: string } | undefined) => void; error: Err; disabled: boolean; optional?: boolean }) {
  const v = value ?? { label: "", href: "" };
  const set = (changes: Partial<typeof v>) => {
    const next = { ...v, ...changes };
    onChange(optional && !next.label && !next.href ? undefined : next);
  };
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>
        {label}
        {optional && <span className={styles.optional}> (optional)</span>}
      </legend>
      <div className={styles.row}>
        <FormField label="Button text" required={!optional} error={error("label")} disabled={disabled}>
          <Input maxLength={80} value={v.label} onChange={(e) => set({ label: e.target.value })} />
        </FormField>
        <FormField label="Link" required={!optional} helper="A site path like /about, or an https:// address." error={error("href")} disabled={disabled}>
          <Input maxLength={2048} value={v.href} onChange={(e) => set({ href: e.target.value.trim() })} />
        </FormField>
      </div>
    </fieldset>
  );
}

export function ImageField({ label, value, onChange, error, disabled, helper, optional }: { label: string; value: string | undefined; onChange: (v: string | undefined) => void; error?: string; disabled: boolean; helper?: string; optional?: boolean }) {
  return <MediaPicker label={label} helper={helper ?? (optional ? "Optional." : "Required.")} value={value || undefined} onChange={(id) => onChange(id ?? (optional ? undefined : ""))} disabled={disabled} error={error} />;
}

/* An ordered list of items with Add, Remove and keyboard-reachable
   Move up / Move down. Focus follows a moved item's button. Without
   `make` the list has no Add button (the caller offers its own — the form
   builder's "Add a question"); with `duplicate`, each item has a Duplicate
   button that puts the copy under it. */
export function ItemList<T>({ label, items, onChange, render, make, max, disabled, itemLabel, error, addLabel, duplicate }: { label: string; items: T[]; onChange: (items: T[]) => void; render: (item: T, set: (item: T) => void, i: number) => ReactNode; make?: () => T; max: number; disabled: boolean; itemLabel: (i: number) => string; error?: string; addLabel?: string; duplicate?: (item: T, items: T[]) => T }) {
  const move = (i: number, by: number, action: "up" | "down") => {
    const next = [...items];
    const [item] = next.splice(i, 1);
    next.splice(i + by, 0, item!);
    onChange(next);
    // Focus follows the item; at the top or bottom that move button is disabled, so its other one.
    requestAnimationFrame(() => {
      const button = (move: string) => document.querySelector<HTMLButtonElement>(`[data-list="${label}"][data-item="${i + by}"][data-move="${move}"]`);
      const same = button(action);
      (same && !same.disabled ? same : button(action === "up" ? "down" : "up"))?.focus();
    });
  };
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{label}</legend>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <ol className={styles.items}>
        {items.map((item, i) => (
          <li key={i} className={styles.item}>
            <div className={styles.itemHead}>
              <span className={styles.itemTitle}>{itemLabel(i)}</span>
              <span className={styles.itemActions}>
                <IconButton size="sm" label={`Move ${itemLabel(i)} up`} icon={<ArrowUp />} disabled={disabled || i === 0} onClick={() => move(i, -1, "up")} data-list={label} data-item={i} data-move="up" />
                <IconButton size="sm" label={`Move ${itemLabel(i)} down`} icon={<ArrowDown />} disabled={disabled || i === items.length - 1} onClick={() => move(i, 1, "down")} data-list={label} data-item={i} data-move="down" />
                {duplicate && <IconButton size="sm" label={`Duplicate ${itemLabel(i)}`} icon={<Copy />} disabled={disabled || items.length >= max} onClick={() => onChange([...items.slice(0, i + 1), duplicate(item, items), ...items.slice(i + 1)])} />}
                <IconButton size="sm" label={`Remove ${itemLabel(i)}`} icon={<Trash2 />} disabled={disabled} onClick={() => onChange(items.filter((_, j) => j !== i))} />
              </span>
            </div>
            {render(item, (next) => onChange(items.map((x, j) => (j === i ? next : x))), i)}
          </li>
        ))}
      </ol>
      {make && (
        <div>
          <Button size="sm" leadingIcon={<Plus />} disabled={disabled || items.length >= max} onClick={() => onChange([...items, make()])}>
            {addLabel ?? `Add ${label.toLowerCase().replace(/s$/, "")}`}
          </Button>
        </div>
      )}
    </fieldset>
  );
}

/* Chosen posts, events or appeals — by id, from their own CMS lists. A
   draft can be chosen (and saved); the page is only APPROVED while every
   chosen record is approved or on the website (M14). */
export interface PickableRecord {
  id: string;
  title: string;
  status: string;
  /* A version of it is on the website. */
  live?: boolean;
  detail?: string;
}

/* `itemError` (M48): the API's message for one chosen record, by id — shown
   with its checkbox and announced as its description. */
export function RecordPicker({ label, load, value, onChange, max, disabled, error, itemError }: { label: string; load: () => Promise<PickableRecord[]>; value: string[]; onChange: (ids: string[]) => void; max: number; disabled: boolean; error?: string; itemError?: (id: string) => string | undefined }) {
  const [records, setRecords] = useState<PickableRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    load().then((r) => live && setRecords(r), () => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [load]);
  const byId = new Map((records ?? []).map((r) => [r.id, r]));
  /* Chosen, but not in the list: no box to untick, so each is listed
     below with its own Remove button (blocks/pickerChoices.ts). */
  const unlisted = unlistedChoices(value, records);
  const chosen = value.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{label}</legend>
      <p className={styles.help}>Up to {max}, in this order. Only approved or published records can go live: anything else must be approved first.</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!records && !failed && <Spinner label={`Loading ${label.toLowerCase()}`} />}
      {failed && <p className={styles.error} role="alert">The list could not be loaded.</p>}
      {records && records.length === 0 && <p className={styles.help}>Nothing to choose yet.</p>}
      {records && records.length > 0 && (
        <ul className={styles.picker} aria-label={label}>
          {records.map((r) => {
            const on = value.includes(r.id);
            const problem = on ? itemError?.(r.id) : undefined;
            return (
              <li key={r.id}>
                <Checkbox
                  label={
                    <span className={styles.pickLabel}>
                      {r.title} <Badge tone={isReady(r.status, r.live) ? "success" : "neutral"}>{readinessWord(r.status, r.live)}</Badge>
                    </span>
                  }
                  description={
                    problem ? (
                      <>
                        {r.detail && <span className={styles.itemDetail}>{r.detail}</span>}
                        <span className={`${styles.error} ${styles.itemError}`}>{problem}</span>
                      </>
                    ) : (
                      r.detail
                    )
                  }
                  aria-invalid={problem ? true : undefined}
                  checked={on}
                  disabled={disabled || (!on && value.length >= max)}
                  onChange={(e) => onChange(e.target.checked ? [...value, r.id] : value.filter((id) => id !== r.id))}
                />
              </li>
            );
          })}
        </ul>
      )}
      {unlisted.length > 0 && (
        <div className={styles.unlisted} data-testid="picker-unlisted">
          <p className={styles.error} role="alert">
            Chosen but not in the list — {unlisted.length === 1 ? "a record" : "records"} this organization does not have (or no longer has). Remove {unlisted.length === 1 ? "it" : "them"}, then choose from the list above.
          </p>
          <ul className={styles.unlistedItems} aria-label={`${label} not in the list`}>
            {unlisted.map((id) => (
              <li key={id} className={styles.unlistedItem}>
                <span>
                  <code>{id}</code>
                  {itemError?.(id) && <span className={`${styles.error} ${styles.itemError}`}> {itemError(id)}</span>}
                </span>
                <Button size="sm" leadingIcon={<Trash2 />} disabled={disabled} onClick={() => onChange(withoutChoice(value, id))}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {chosen.some((r) => !isReady(r.status, r.live)) && <p className={styles.help}>Chosen but not approved yet: {chosen.filter((r) => !isReady(r.status, r.live)).map((r) => r.title).join(", ")}.</p>}
    </fieldset>
  );
}

/* The heading group, text and link button most blocks share. */
export const sub = (err: Err, prefix: string): Err => (path) => err(path ? `${prefix}.${path}` : prefix);
export const clean = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/* Kicker, heading, highlight: the heading group most blocks share. */
export function HeadingFields<D extends { kicker?: string; heading: string; highlight?: string }>({ data, set, err, disabled, kicker = true }: { data: D; set: (d: D) => void; err: Err; disabled: boolean; kicker?: boolean }) {
  return (
    <>
      {kicker && <TextField label="Kicker" helper="Optional. A short label above the heading." max={60} value={data.kicker} onChange={(kicker) => set(clean({ ...data, kicker }))} error={err("kicker")} disabled={disabled} />}
      <TextField label="Heading" required max={160} value={data.heading} onChange={(heading) => set({ ...data, heading: heading ?? "" })} error={err("heading")} disabled={disabled} />
      <TextField label="Highlight" helper="Optional. A word or phrase from the heading to set on a highlight block." max={60} value={data.highlight} onChange={(highlight) => set(clean({ ...data, highlight }))} error={err("highlight")} disabled={disabled} />
    </>
  );
}

export const Body = <D extends { body?: string }>({ data, set, err, disabled, label = "Text" }: { data: D; set: (d: D) => void; err: Err; disabled: boolean; label?: string }) => (
  <TextField label={label} multiline helper="Optional." max={600} value={data.body} onChange={(body) => set(clean({ ...data, body }))} error={err("body")} disabled={disabled} />
);

export const Cta = <D extends { cta?: { label: string; href: string } }>({ data, set, err, disabled, label = "Link button" }: { data: D; set: (d: D) => void; err: Err; disabled: boolean; label?: string }) => (
  <LinkField label={label} optional value={data.cta} onChange={(cta) => set(clean({ ...data, cta }))} error={sub(err, "cta")} disabled={disabled} />
);
