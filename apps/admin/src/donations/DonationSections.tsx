import { useState } from "react";
import type { RichText, Section } from "@rbb/content-schema";
import { Button, Checkbox, FormField, IconButton, Input, Plus, Select, Textarea, Trash2 } from "../design-system";
import { RichTextEditor } from "../content/RichTextEditor";
import { Body, Cta, HeadingFields, ItemList, ParagraphsField, TextField, clean } from "../blocks/fields";
import styles from "../content/content.module.css";
import { MAX_LISTS, freshId, listsOf, paragraphsToRichText, replaceLists, replaceOne, richTextToParagraphs, sectionOf, whyOf, type ListSection } from "./sections";

/* What a donation page says below its form, as the website draws it on a
   donation page (an appeal, or the general donation page):

     "Why it matters"          a statement (kicker, heading, highlight,
                               paragraphs, a link) or formatted text —
                               edited as what it is (Milestone 7: a
                               statement is no longer turned into formatted
                               text on save)
     "How your support helps"  numbered cards, with a kicker, highlight and
                               intro
     appeal lists              (Milestone 7) the page's own, or the page's
                               built-in appeal bands
     trust panel               (Milestone 7) the site's transparency panel,
                               or the page's own wording (its documents stay
                               the transparency records')
     questions                 (Milestone 7) the site's donation questions,
                               or the page's own

   Stored as the contract's section blocks (./sections.ts keeps them in the
   page's order); sections of other types on the record are kept. A passage
   left completely empty is removed rather than saved half-filled. */

type Statement = Extract<Section, { type: "statement" }>;
type Formatted = Extract<Section, { type: "richText" }>;
type Helps = Extract<Section, { type: "numberedCards" }>;
type Trust = Extract<Section, { type: "trust" }>;
type Faq = Extract<Section, { type: "faq" }>;
type Err = (path: string) => string | undefined;

interface Props {
  value: Section[];
  onChange: (sections: Section[]) => void;
  disabled: boolean;
  error: (path: string) => string | undefined;
  /* The error-path prefix ("sections"). */
  path: string;
  /* "appeal" or "page": the wording of the defaults. */
  noun?: string;
}

const KINDS = [
  { value: "", label: "Every appeal" },
  { value: "emergency", label: "Emergency response appeals" },
  { value: "campaign", label: "Campaigns" },
  { value: "special", label: "Special appeals" },
];

export function DonationSections({ value, onChange, disabled, error, path, noun = "page" }: Props) {
  const indexOf = (s: Section | null) => (s ? value.indexOf(s) : -1);
  /* Errors under one section's data, by its index. */
  const dataErr = (s: Section | null): Err => {
    const i = indexOf(s);
    return (p) => (i < 0 ? undefined : error(p ? `${path}.${i}.data.${p}` : `${path}.${i}`));
  };
  const sectionErr = (s: Section | null) => {
    const i = indexOf(s);
    return i < 0 ? undefined : [error(`${path}.${i}`), error(`${path}.${i}.data`)].filter(Boolean).join(" ") || undefined;
  };

  /* ---- Why it matters ---- */
  const why = whyOf(value);
  const whyErr = dataErr(why);
  const setWhy = (next: Statement | Formatted | null) => onChange(replaceOne(value, (s) => s.type === "statement" || s.type === "richText", next));
  const asStatement = (data: Statement["data"]): Statement | null => (!data.heading.trim() && !data.body.join("").trim() ? null : { id: why?.id ?? freshId(value, "why"), type: "statement", enabled: why?.enabled ?? true, version: 1, data });
  const asFormatted = (data: Formatted["data"]): Formatted | null => (!data.heading.trim() && !data.content.length ? null : { id: why?.id ?? freshId(value, "why"), type: "richText", enabled: why?.enabled ?? true, version: 1, data });
  const statement: Statement["data"] = why?.type === "statement" ? why.data : { heading: why?.data.heading ?? "", body: [] };
  const formatted: Formatted["data"] = why?.type === "richText" ? why.data : { heading: why?.data.heading ?? "", content: [] as unknown as RichText };
  /* The form chosen for a passage not written yet (nothing is saved until it has words). */
  const [chosen, setChosen] = useState<"statement" | "richText">("richText");
  const form = why?.type ?? chosen;
  const switchWhy = (next: string) => {
    setChosen(next === "statement" ? "statement" : "richText");
    if (next === "statement" && why?.type === "richText") setWhy(asStatement({ heading: why.data.heading, body: richTextToParagraphs(why.data.content) }));
    if (next === "richText" && why?.type === "statement") setWhy(asFormatted({ heading: why.data.heading, content: paragraphsToRichText(why.data.body) }));
  };

  /* ---- How your support helps ---- */
  const helpsSection = sectionOf(value, "numberedCards");
  const helps: Helps["data"] = helpsSection?.data ?? { heading: "", items: [] };
  const helpsErr = dataErr(helpsSection);
  const setHelps = (data: Helps["data"]) => {
    const empty = !data.heading.trim() && !data.items.length && !data.kicker && !data.intro;
    onChange(replaceOne(value, (s) => s.type === "numberedCards", empty ? null : { id: helpsSection?.id ?? freshId(value, "helps"), type: "numberedCards", enabled: helpsSection?.enabled ?? true, version: 1, data: clean(data) }));
  };
  const setItem = (i: number, item: Partial<Helps["data"]["items"][number]>) =>
    setHelps({ ...helps, items: helps.items.map((it, j) => (j === i ? Object.fromEntries(Object.entries({ ...it, ...item }).filter(([, v]) => v !== "" && v !== undefined)) : it)) as Helps["data"]["items"] });

  /* ---- Appeal lists, trust panel, questions ---- */
  const lists = listsOf(value);
  const setLists = (next: ListSection[]) => onChange(replaceLists(value, next));
  const trust = sectionOf(value, "trust");
  const setTrust = (next: Trust | null) => onChange(replaceOne(value, (s) => s.type === "trust", next));
  const faq = sectionOf(value, "faq");
  const setFaq = (next: Faq | null) => onChange(replaceOne(value, (s) => s.type === "faq", next));

  return (
    <div className={styles.sections}>
      <div className={styles.fields}>
        <FormField label="“Why it matters” — form" disabled={disabled} helper="A statement: a short heading and plain paragraphs, with an optional kicker, highlight and link. Formatted text: a heading and text with headings and lists. Switching keeps the heading and the words.">
          <Select options={[{ value: "statement", label: "Statement" }, { value: "richText", label: "Formatted text" }]} value={form} onChange={(e) => switchWhy(e.target.value)} />
        </FormField>
        {form === "statement" ? (
          <>
            <HeadingFields data={statement} set={(d) => setWhy(asStatement(d))} err={whyErr} disabled={disabled} />
            <ParagraphsField label="“Why it matters” text" helper="Separate paragraphs with a blank line. The first is set as a statement." value={statement.body} onChange={(body) => setWhy(asStatement({ ...statement, body }))} error={whyErr("body")} disabled={disabled} />
            <Cta data={statement} set={(d) => setWhy(asStatement(d))} err={whyErr} disabled={disabled} />
          </>
        ) : (
          <>
            <FormField label="“Why it matters” heading" disabled={disabled} error={sectionErr(why) ?? whyErr("heading")} helper="Leave the heading and text empty to leave this passage out.">
              <Input maxLength={160} value={formatted.heading} onChange={(e) => setWhy(asFormatted({ ...formatted, heading: e.target.value }))} />
            </FormField>
            <RichTextEditor label="“Why it matters” text" value={formatted.content} onChange={(content) => setWhy(asFormatted({ ...formatted, content }))} disabled={disabled} error={whyErr("content")} helper="Paragraphs, headings and lists." />
          </>
        )}
      </div>

      <div className={styles.fields}>
        <HeadingFields data={helps} set={setHelps} err={helpsErr} disabled={disabled} />
        <TextField label="Introduction" helper="Optional. One line under the heading." max={400} value={helps.intro} onChange={(intro) => setHelps(clean({ ...helps, intro }))} error={helpsErr("intro")} disabled={disabled} />
        <ol className={styles.itemList} aria-label="How your support helps — items">
          {helps.items.map((item, i) => (
            <li key={i} className={styles.item}>
              <FormField label={`Item ${i + 1}`} disabled={disabled} error={helpsErr(`items.${i}.title`)}>
                <Input maxLength={120} value={item.title} onChange={(e) => setItem(i, { title: e.target.value })} />
              </FormField>
              <FormField label={`Item ${i + 1} description`} disabled={disabled}>
                <Textarea rows={2} maxLength={600} value={item.description ?? ""} onChange={(e) => setItem(i, { description: e.target.value })} />
              </FormField>
              <IconButton label={`Remove item ${i + 1}`} icon={<Trash2 />} size="sm" disabled={disabled} onClick={() => setHelps({ ...helps, items: helps.items.filter((_, j) => j !== i) })} />
            </li>
          ))}
        </ol>
        <div>
          <Button size="sm" leadingIcon={<Plus />} disabled={disabled || helps.items.length >= 8} onClick={() => setHelps({ ...helps, items: [...helps.items, { title: "" }] })}>
            Add item
          </Button>
        </div>
        {helpsSection && sectionErr(helpsSection) && <p className={styles.muted}>{sectionErr(helpsSection)}</p>}
      </div>

      <div className={styles.fields}>
        <FormField label="Appeal lists" disabled={disabled} helper={`The ${noun}'s own lists of appeals, in place of its built-in appeal bands. Each lists the published appeals of one kind, or all of them.`}>
          <Select options={[{ value: "site", label: `The ${noun}'s built-in appeal bands` }, { value: "own", label: "Choose the lists" }]} value={lists.length ? "own" : "site"} onChange={(e) => setLists(e.target.value === "own" ? [{ id: freshId(value, "appeals"), type: "appealList", enabled: true, version: 1, data: { heading: "Appeals" } }] : [])} />
        </FormField>
        {lists.length > 0 && (
          <ItemList<ListSection>
            label="Lists"
            items={lists}
            max={MAX_LISTS}
            disabled={disabled}
            itemLabel={(i) => `List ${i + 1}`}
            addLabel="Add a list"
            onChange={setLists}
            make={() => ({ id: freshId([...value], `appeals-${lists.length + 1}`), type: "appealList", enabled: true, version: 1, data: { heading: "Appeals" } })}
            render={(list, set) => {
              const err = dataErr(list);
              return (
                <div className={styles.fields}>
                  <HeadingFields data={list.data} set={(data) => set({ ...list, data })} err={err} disabled={disabled} />
                  <FormField label="Which appeals" disabled={disabled} error={err("kind")}>
                    <Select options={KINDS} value={list.data.kind ?? ""} onChange={(e) => set({ ...list, data: clean({ ...list.data, kind: (e.target.value || undefined) as ListSection["data"]["kind"] }) })} />
                  </FormField>
                  <Cta data={list.data} set={(data) => set({ ...list, data })} err={err} disabled={disabled} label="Link button (optional; a list of one kind links to that kind's page)" />
                  <Checkbox label="Show this list" checked={list.enabled} disabled={disabled} onChange={(e) => set({ ...list, enabled: e.target.checked })} />
                </div>
              );
            }}
          />
        )}
      </div>

      <div className={styles.fields}>
        <FormField label="Trust panel" disabled={disabled} helper="The transparency panel. The documents beneath it always come from the website's transparency records." error={sectionErr(trust)}>
          <Select options={[{ value: "site", label: "The site's transparency panel" }, { value: "own", label: `This ${noun}'s own wording` }]} value={trust ? "own" : "site"} onChange={(e) => setTrust(e.target.value === "own" ? { id: freshId(value, "trust"), type: "trust", enabled: true, version: 1, data: { heading: "" } } : null)} />
        </FormField>
        {trust && (
          <>
            <HeadingFields data={trust.data} set={(data) => setTrust({ ...trust, data })} err={dataErr(trust)} disabled={disabled} />
            <Body data={trust.data} set={(data) => setTrust({ ...trust, data })} err={dataErr(trust)} disabled={disabled} />
            <Cta data={trust.data} set={(data) => setTrust({ ...trust, data })} err={dataErr(trust)} disabled={disabled} />
            <Checkbox label={`Show a trust panel on this ${noun}`} description="Unticked: none on this page." checked={trust.enabled} disabled={disabled} onChange={(e) => setTrust({ ...trust, enabled: e.target.checked })} />
          </>
        )}
      </div>

      <div className={styles.fields}>
        <FormField label="Questions" disabled={disabled} helper="Frequently asked questions near the end of the page." error={sectionErr(faq)}>
          <Select options={[{ value: "site", label: noun === "appeal" ? "None (as before)" : "The site's donation questions" }, { value: "own", label: `This ${noun}'s own questions` }]} value={faq ? "own" : "site"} onChange={(e) => setFaq(e.target.value === "own" ? { id: freshId(value, "faq"), type: "faq", enabled: true, version: 1, data: { heading: "", items: [{ question: "", answer: "" }] } } : null)} />
        </FormField>
        {faq && (
          <>
            <HeadingFields data={faq.data} set={(data) => setFaq({ ...faq, data })} err={dataErr(faq)} disabled={disabled} />
            <ItemList
              label="Questions and answers"
              items={faq.data.items}
              max={30}
              disabled={disabled}
              error={dataErr(faq)("items")}
              itemLabel={(i) => `Question ${i + 1}`}
              addLabel="Add a question"
              onChange={(items) => setFaq({ ...faq, data: { ...faq.data, items: items as Faq["data"]["items"] } })}
              make={() => ({ question: "", answer: "" })}
              render={(item, setItem, i) => (
                <div className={styles.fields}>
                  <TextField label="Question" required max={300} value={item.question} onChange={(question) => setItem({ ...item, question: question ?? "" })} error={dataErr(faq)(`items.${i}.question`)} disabled={disabled} />
                  <TextField label="Answer" required multiline max={3000} value={item.answer} onChange={(answer) => setItem({ ...item, answer: answer ?? "" })} error={dataErr(faq)(`items.${i}.answer`)} disabled={disabled} />
                </div>
              )}
            />
            <Checkbox label={`Show questions on this ${noun}`} description="Unticked: none on this page." checked={faq.enabled} disabled={disabled} onChange={(e) => setFaq({ ...faq, enabled: e.target.checked })} />
          </>
        )}
      </div>
    </div>
  );
}
