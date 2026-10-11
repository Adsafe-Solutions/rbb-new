import type { RichText, Section } from "@rbb/content-schema";
import { Button, FormField, IconButton, Input, Plus, Textarea, Trash2 } from "../design-system";
import { RichTextEditor } from "../content/RichTextEditor";
import styles from "../content/content.module.css";

/* What a donation page says below its form: "why it matters" (rich text)
   and "how your support helps" (numbered cards) — the two blocks the
   website draws on a donation page. Stored as the contract's section
   blocks; other blocks on the record are kept as they are. A passage left
   completely empty is removed rather than saved half-filled. */

type Why = Extract<Section, { type: "richText" }>;
type Helps = Extract<Section, { type: "numberedCards" }>;

const paragraphs = (body: string[]): RichText => body.map((text) => ({ type: "paragraph", children: [{ type: "text", text }] }));

interface Props {
  value: Section[];
  onChange: (sections: Section[]) => void;
  disabled: boolean;
  error: (path: string) => string | undefined;
  /* The error-path prefix ("sections"). */
  path: string;
}

export function DonationSections({ value, onChange, disabled, error, path }: Props) {
  const whyAt = value.findIndex((s) => s.type === "richText" || s.type === "statement");
  const helpsAt = value.findIndex((s) => s.type === "numberedCards");
  const current = whyAt >= 0 ? value[whyAt]! : null;
  const why = current?.type === "statement" ? { heading: current.data.heading, content: paragraphs(current.data.body) } : current?.type === "richText" ? current.data : { heading: "", content: [] as RichText };
  const helps = helpsAt >= 0 ? (value[helpsAt] as Helps).data : { heading: "", items: [] as Helps["data"]["items"] };
  const errorsUnder = (at: number) => (at < 0 ? undefined : [error(`${path}.${at}`), error(`${path}.${at}.data.heading`)].filter(Boolean).join(" ") || undefined);

  const put = (at: number, section: Section | null, fallbackIndex: number) => {
    const next = [...value];
    if (at >= 0) {
      if (section) next[at] = section;
      else next.splice(at, 1);
    } else if (section) next.splice(Math.min(fallbackIndex, next.length), 0, section);
    onChange(next);
  };
  const setWhy = (data: Partial<Why["data"]>) => {
    const merged = { ...why, ...data };
    const empty = !merged.heading.trim() && !merged.content.length;
    put(whyAt, empty ? null : { id: current?.id ?? "why", type: "richText", enabled: current?.enabled ?? true, version: 1, data: merged }, 0);
  };
  const setHelps = (data: Partial<Helps["data"]>) => {
    const merged = { ...helps, ...data };
    const empty = !merged.heading.trim() && !merged.items.length;
    const existing = helpsAt >= 0 ? (value[helpsAt] as Helps) : null;
    put(helpsAt, empty ? null : { id: existing?.id ?? "helps", type: "numberedCards", enabled: existing?.enabled ?? true, version: 1, data: merged }, whyAt + 1);
  };
  const setItem = (i: number, item: Partial<Helps["data"]["items"][number]>) =>
    setHelps({ items: helps.items.map((it, j) => (j === i ? Object.fromEntries(Object.entries({ ...it, ...item }).filter(([, v]) => v !== "" && v !== undefined)) : it)) as Helps["data"]["items"] });

  return (
    <div className={styles.sections}>
      <div className={styles.fields}>
        <FormField label="“Why it matters” heading" disabled={disabled} error={errorsUnder(whyAt)} helper="Leave the heading and text empty to leave this passage out.">
          <Input maxLength={160} value={why.heading} onChange={(e) => setWhy({ heading: e.target.value })} />
        </FormField>
        <RichTextEditor
          label="“Why it matters” text"
          value={why.content}
          onChange={(content) => setWhy({ content })}
          disabled={disabled}
          error={whyAt >= 0 ? error(`${path}.${whyAt}.data.content`) : undefined}
          helper={current?.type === "statement" ? "Saving turns this passage into formatted text." : "Paragraphs, headings and lists."}
        />
      </div>
      <div className={styles.fields}>
        <FormField label="“How your support helps” heading" disabled={disabled} error={errorsUnder(helpsAt)} helper="General areas support goes to — never a costed claim.">
          <Input maxLength={160} value={helps.heading} onChange={(e) => setHelps({ heading: e.target.value })} />
        </FormField>
        <ol className={styles.itemList} aria-label="How your support helps — items">
          {helps.items.map((item, i) => (
            <li key={i} className={styles.item}>
              <FormField label={`Item ${i + 1}`} disabled={disabled} error={helpsAt >= 0 ? error(`${path}.${helpsAt}.data.items.${i}.title`) : undefined}>
                <Input maxLength={120} value={item.title} onChange={(e) => setItem(i, { title: e.target.value })} />
              </FormField>
              <FormField label={`Item ${i + 1} description`} disabled={disabled}>
                <Textarea rows={2} maxLength={600} value={item.description ?? ""} onChange={(e) => setItem(i, { description: e.target.value })} />
              </FormField>
              <IconButton label={`Remove item ${i + 1}`} icon={<Trash2 />} size="sm" disabled={disabled} onClick={() => setHelps({ items: helps.items.filter((_, j) => j !== i) })} />
            </li>
          ))}
        </ol>
        <div>
          <Button size="sm" leadingIcon={<Plus />} disabled={disabled || helps.items.length >= 8} onClick={() => setHelps({ items: [...helps.items, { title: "" }] })}>
            Add item
          </Button>
        </div>
      </div>
    </div>
  );
}
