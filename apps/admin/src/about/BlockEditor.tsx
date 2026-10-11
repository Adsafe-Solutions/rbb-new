import type { ReactNode } from "react";
import { ABOUT_BLOCKS } from "@rbb/content-schema/about-registry";
import { Body, Cta, HeadingFields, ImageField, ItemList, LinkField, ParagraphsField, TextField, clean, sub } from "../blocks/fields";
import type { AboutBlockData, AboutBlockType, AboutSection } from "./client";
import styles from "../blocks/blocks.module.css";

/* The About page's block forms: typed fields for exactly what each
   chapter's component draws. EDITORS is explicit — type → form — like the
   website's renderers (pages/About/CmsAbout). Milestone 8: a statement's
   link, mission and vision's highlight and the values' intro are drawn
   now, so they are offered. */

export const ABOUT_BLOCK_INFO = ABOUT_BLOCKS;

type Err = (path: string) => string | undefined;
interface EditorProps<T extends AboutBlockType> {
  data: AboutBlockData<T>;
  set: (data: AboutBlockData<T>) => void;
  err: Err;
  disabled: boolean;
}

const link = () => ({ label: "", href: "" });

/* Starting data for a new block: the fields an editor fills in. */
export function newAboutBlockData(type: AboutBlockType): AboutSection["data"] {
  switch (type) {
    case "pageHero":
      return { title: "", body: "" };
    case "statement":
      return { heading: "", body: [""] };
    case "missionVision":
      return { heading: "", mission: { label: "Our Mission", statement: "" }, vision: { label: "Our Vision", statement: "" } };
    case "numberedCards":
      return { heading: "", items: [{ title: "" }] };
    case "transparency":
      return {};
    case "cta":
      return { heading: "", primary: link() };
    default:
      return { heading: "" };
  }
}

export function aboutSummary(section: AboutSection): string {
  const d = section.data as Record<string, unknown>;
  if (section.type === "pageHero") return section.data.title || "No title yet";
  if (section.type === "transparency") return "From the website's transparency records";
  return (typeof d.heading === "string" && d.heading) || "No heading yet";
}

const Statement = ({ label, value, onChange, err, disabled }: { label: string; value: { label: string; statement: string }; onChange: (v: { label: string; statement: string }) => void; err: Err; disabled: boolean }) => (
  <fieldset className={styles.group}>
    <legend className={styles.legend}>{label}</legend>
    <TextField label={`${label} label`} required max={60} value={value.label} onChange={(l) => onChange({ ...value, label: l ?? "" })} error={err("label")} disabled={disabled} />
    <TextField label={`${label} statement`} required multiline max={400} value={value.statement} onChange={(s) => onChange({ ...value, statement: s ?? "" })} error={err("statement")} disabled={disabled} />
  </fieldset>
);

const EDITORS: { [T in AboutBlockType]: (p: EditorProps<T>) => ReactNode } = {
  pageHero: ({ data, set, err, disabled }) => (
    <>
      <TextField label="Page title" required helper="The page's main heading." max={120} value={data.title} onChange={(title) => set({ ...data, title: title ?? "" })} error={err("title")} disabled={disabled} />
      <TextField label="Breadcrumb name" helper="Optional. The page's name in the breadcrumb, when shorter than the title." max={60} value={data.crumb} onChange={(crumb) => set(clean({ ...data, crumb }))} error={err("crumb")} disabled={disabled} />
      <TextField label="Opening line" required multiline max={400} value={data.body} onChange={(body) => set({ ...data, body: body ?? "" })} error={err("body")} disabled={disabled} />
      <LinkField label="Button" optional value={data.cta} onChange={(cta) => set(clean({ ...data, cta }))} error={sub(err, "cta")} disabled={disabled} />
    </>
  ),
  statement: ({ data, set, err, disabled }) => (
    <>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <ParagraphsField label="Paragraphs" helper="Separate paragraphs with a blank line. The first is set as a statement." value={data.body} onChange={(body) => set({ ...data, body: body as typeof data.body })} error={err("body") ?? err("body.0")} disabled={disabled} />
      <Cta data={data} set={set} err={err} disabled={disabled} />
    </>
  ),
  missionVision: ({ data, set, err, disabled }) => (
    <>
      <TextField label="Kicker" helper="Optional. A short label above the heading." max={60} value={data.kicker} onChange={(kicker) => set(clean({ ...data, kicker }))} error={err("kicker")} disabled={disabled} />
      <TextField label="Heading" required max={160} value={data.heading} onChange={(heading) => set({ ...data, heading: heading ?? "" })} error={err("heading")} disabled={disabled} />
      <TextField label="Highlight" helper="Optional. A word or phrase from the heading to set on a highlight block." max={60} value={data.highlight} onChange={(highlight) => set(clean({ ...data, highlight }))} error={err("highlight")} disabled={disabled} />
      <Statement label="Mission" value={data.mission} onChange={(mission) => set({ ...data, mission })} err={sub(err, "mission")} disabled={disabled} />
      <Statement label="Vision" value={data.vision} onChange={(vision) => set({ ...data, vision })} err={sub(err, "vision")} disabled={disabled} />
      <TextField label="Source line" helper="Optional. Where the statements come from." max={300} value={data.source} onChange={(source) => set(clean({ ...data, source }))} error={err("source")} disabled={disabled} />
    </>
  ),
  numberedCards: ({ data, set, err, disabled }) => (
    <>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <TextField label="Introduction" helper="Optional. One line under the heading." max={400} value={data.intro} onChange={(intro) => set(clean({ ...data, intro }))} error={err("intro")} disabled={disabled} />
      <ItemList
        label="Values"
        items={data.items}
        max={8}
        disabled={disabled}
        error={err("items")}
        itemLabel={(i) => `Value ${i + 1}`}
        onChange={(items) => set({ ...data, items: items as typeof data.items })}
        make={() => ({ title: "" }) as (typeof data.items)[number]}
        render={(item, setItem, i) => (
          <div className={styles.fields}>
            <TextField label="Value" required max={120} value={item.title} onChange={(title) => setItem({ ...item, title: title ?? "" })} error={err(`items.${i}.title`)} disabled={disabled} />
            <TextField label="Description" multiline helper="Optional." max={600} value={item.description} onChange={(description) => setItem(clean({ ...item, description }))} error={err(`items.${i}.description`)} disabled={disabled} />
          </div>
        )}
      />
    </>
  ),
  approach: ({ data, set, err, disabled }) => (
    <>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <Body data={data} set={set} err={err} disabled={disabled} label="Statement" />
      <Cta data={data} set={set} err={err} disabled={disabled} />
    </>
  ),
  transparency: () => <p className={styles.help}>Financial information, documents and governance come from Transparency (edited under Transparency, with its documents). This block places that chapter on the page.</p>,
  cta: ({ data, set, err, disabled }) => (
    <>
      <TextField label="Heading" required max={160} value={data.heading} onChange={(heading) => set({ ...data, heading: heading ?? "" })} error={err("heading")} disabled={disabled} />
      <TextField label="Highlight" helper="Optional. A word or phrase from the heading." max={60} value={data.highlight} onChange={(highlight) => set(clean({ ...data, highlight }))} error={err("highlight")} disabled={disabled} />
      <Body data={data} set={set} err={err} disabled={disabled} />
      <LinkField label="Main button" value={data.primary} onChange={(primary) => set({ ...data, primary: primary! })} error={sub(err, "primary")} disabled={disabled} />
      <LinkField label="Second button" optional value={data.secondary} onChange={(secondary) => set(clean({ ...data, secondary }))} error={sub(err, "secondary")} disabled={disabled} />
      <ImageField label="Photograph" optional helper="Optional. Shown beside the closing ask." value={data.imageId} onChange={(imageId) => set(clean({ ...data, imageId }))} error={err("imageId")} disabled={disabled} />
    </>
  ),
};

export function AboutBlockEditor({ section, onChange, errors, disabled }: { section: AboutSection; onChange: (section: AboutSection) => void; errors: Map<string, string> | undefined; disabled: boolean }) {
  const Editor = EDITORS[section.type] as (p: EditorProps<AboutBlockType>) => ReactNode;
  const err: Err = (path) => errors?.get(path);
  return (
    <div className={styles.fields}>
      {errors?.get("") && <p className={styles.error} role="alert">{errors.get("")}</p>}
      <Editor data={section.data as AboutBlockData<AboutBlockType>} set={(data) => onChange({ ...section, data } as AboutSection)} err={err} disabled={disabled} />
    </div>
  );
}
