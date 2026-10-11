import { useEffect, useId, useRef, useState } from "react";
import { Button, IconButton, Label, Select, Trash2, cx } from "../design-system";
import { fromEditable, toEditable, unsafeLinks, type BlockKind, type EditableBlock, type RichText } from "./richtext";
import styles from "./RichTextEditor.module.css";

/* The rich-text editor: blocks of text, each with a kind, written in plain
   text areas (accessible, predictable, no HTML). Bold, italic and links
   are typed — or inserted with the buttons — as **bold**, *italic* and
   [text](address); richtext.ts turns that into the content contract's
   JSON on every change. Only what the contract defines can be produced. */

const KINDS: { value: BlockKind; label: string }[] = [
  { value: "paragraph", label: "Paragraph" },
  { value: "heading2", label: "Heading" },
  { value: "heading3", label: "Subheading" },
  { value: "bullet", label: "Bulleted list" },
  { value: "ordered", label: "Numbered list" },
];

interface RichTextEditorProps {
  label: string;
  value: RichText | undefined;
  onChange: (value: RichText) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  helper?: string;
}

export function RichTextEditor({ label, value, onChange, disabled, required, error, helper }: RichTextEditorProps) {
  const id = useId();
  const [blocks, setBlocks] = useState<EditableBlock[]>(() => toEditable(value));
  const areas = useRef<(HTMLTextAreaElement | null)[]>([]);
  const lastEmitted = useRef<string>(JSON.stringify(value ?? []));

  // A new record (or a reload) replaces the blocks; our own edits do not.
  useEffect(() => {
    const incoming = JSON.stringify(value ?? []);
    if (incoming !== lastEmitted.current) {
      lastEmitted.current = incoming;
      setBlocks(toEditable(value));
    }
  }, [value]);

  const commit = (next: EditableBlock[]) => {
    setBlocks(next);
    const doc = fromEditable(next);
    lastEmitted.current = JSON.stringify(doc);
    onChange(doc);
  };
  const set = (i: number, block: Partial<EditableBlock>) => commit(blocks.map((b, j) => (j === i ? { ...b, ...block } : b)));
  const move = (i: number, by: -1 | 1) => {
    const next = [...blocks];
    [next[i], next[i + by]] = [next[i + by]!, next[i]!];
    commit(next);
    requestAnimationFrame(() => areas.current[i + by]?.focus());
  };

  /* Wraps the selection (or inserts a placeholder) and keeps it selected. */
  const wrap = (i: number, before: string, after: string, placeholder: string) => {
    const area = areas.current[i];
    if (!area) return;
    const { selectionStart: s, selectionEnd: e, value: text } = area;
    const inner = text.slice(s, e) || placeholder;
    set(i, { text: text.slice(0, s) + before + inner + after + text.slice(e) });
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(s + before.length, s + before.length + inner.length);
    });
  };

  const unsafe = unsafeLinks(fromEditable(blocks));
  const describedBy = [helper && `${id}-helper`, error && `${id}-error`, unsafe.length && `${id}-links`].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.editor} role="group" aria-labelledby={`${id}-label`} aria-describedby={describedBy}>
      <Label id={`${id}-label`} required={required}>
        {label}
      </Label>
      {helper && (
        <p id={`${id}-helper`} className={styles.helper}>
          {helper} Format with **bold**, *italic* and [link text](https://…).
        </p>
      )}
      <ol className={cx(styles.blocks, error && styles.invalid)}>
        {blocks.map((block, i) => (
          <li key={i} className={styles.block} data-testid="rich-block">
            <div className={styles.toolbar}>
              <Select size="sm" aria-label={`Block ${i + 1} type`} options={KINDS} value={block.kind} disabled={disabled} onChange={(e) => set(i, { kind: e.target.value as BlockKind })} />
              {!disabled && (
                <span className={styles.tools}>
                  <Button size="sm" variant="ghost" aria-label={`Bold (block ${i + 1})`} onClick={() => wrap(i, "**", "**", "bold text")}>
                    <strong>B</strong>
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Italic (block ${i + 1})`} onClick={() => wrap(i, "*", "*", "italic text")}>
                    <em>I</em>
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Link (block ${i + 1})`} onClick={() => wrap(i, "[", "](https://)", "link text")}>
                    Link
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Move block ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Move block ${i + 1} down`} disabled={i === blocks.length - 1} onClick={() => move(i, 1)}>
                    ↓
                  </Button>
                  <IconButton size="sm" label={`Remove block ${i + 1}`} icon={<Trash2 />} disabled={blocks.length === 1} onClick={() => commit(blocks.filter((_, j) => j !== i))} />
                </span>
              )}
            </div>
            <textarea
              ref={(el) => {
                areas.current[i] = el;
              }}
              className={cx(styles.text, block.kind === "heading2" && styles.h2, block.kind === "heading3" && styles.h3)}
              aria-label={`Block ${i + 1} (${KINDS.find((k) => k.value === block.kind)!.label}) text`}
              rows={block.kind.startsWith("heading") ? 1 : block.kind === "paragraph" ? 4 : 3}
              placeholder={block.kind === "bullet" || block.kind === "ordered" ? "One item per line" : ""}
              value={block.text}
              disabled={disabled}
              onChange={(e) => set(i, { text: e.target.value })}
            />
          </li>
        ))}
      </ol>
      {!disabled && (
        <div className={styles.add}>
          <Button size="sm" onClick={() => commit([...blocks, { kind: "paragraph", text: "" }])}>
            Add paragraph
          </Button>
          <Button size="sm" variant="ghost" onClick={() => commit([...blocks, { kind: "heading2", text: "" }])}>
            Add heading
          </Button>
          <Button size="sm" variant="ghost" onClick={() => commit([...blocks, { kind: "bullet", text: "" }])}>
            Add list
          </Button>
        </div>
      )}
      {unsafe.length > 0 && (
        <p id={`${id}-links`} className={styles.error}>
          These link addresses aren't allowed: {unsafe.join(", ")}. Use https://, a /page on the site, mailto: or tel:.
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
