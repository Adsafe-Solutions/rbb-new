import type { ReactNode } from "react";
import { IMPACT_BLOCKS } from "@rbb/content-schema/impact-registry";
import { Body, Cta, HeadingFields, ImageField, ItemList, LinkField, TextField, clean, sub } from "../blocks/fields";
import { MetricsField } from "./MetricsField";
import { regionId, takenElsewhere } from "./geography";
import { CountryPicker } from "./CountryPicker";
import { ProgramSelect, StoriesField } from "../content/pickers";
import type { ImpactBlockData, ImpactBlockType, ImpactSection } from "./client";
import styles from "../blocks/blocks.module.css";

/* The Impact page's block forms: typed fields for exactly what each
   chapter's component draws (apps/web pages/Impact/CmsImpact). EDITORS is
   explicit — type → form. Figures, programs and stories are NAMED here,
   never restated — chosen from this organization's records (M12 pickers,
   content/pickers); the "to be provided" lines are the website's own. */

export const IMPACT_BLOCK_INFO = IMPACT_BLOCKS;

type Err = (path: string) => string | undefined;
interface EditorProps<T extends ImpactBlockType> {
  data: ImpactBlockData<T>;
  set: (data: ImpactBlockData<T>) => void;
  err: Err;
  disabled: boolean;
}

const link = () => ({ label: "", href: "" });

/* The first API message about one selected country of a list
   ("countries.3: … is already listed in …"), shown on the picker. */
const firstError = (err: Err, path: string, count: number): string | undefined => {
  for (let i = 0; i < count; i += 1) {
    const message = err(`${path}.${i}`);
    if (message) return message;
  }
  return undefined;
};

const teaser = () => ({ heading: "", body: "", cta: link() });

/* Starting data for a new block: the fields an editor fills in. */
export function newImpactBlockData(type: ImpactBlockType): ImpactSection["data"] {
  switch (type) {
    case "intro":
      return { title: "", body: "" };
    case "stats":
      return { heading: "", metricIds: [] as unknown as [string] };
    case "programImpact":
      return { heading: "", items: [] };
    case "teasers":
      return { items: [teaser(), teaser()] };
    case "measurement":
      return { heading: "", items: [] };
    case "stories":
      return { heading: "", storyIds: [] };
    case "cta":
      return { heading: "", primary: link() };
    case "approach":
      return { principles: [] };
    case "geography":
      return { regions: [], countries: [] };
    default:
      return { heading: "" };
  }
}

export function impactSummary(section: ImpactSection): string {
  if (section.type === "intro") return section.data.title || "No title yet";
  if (section.type === "teasers") return section.data.items.map((t) => t.heading || "No heading yet").join(" · ");
  if (section.type === "approach") return `${section.data.principles.length} principle${section.data.principles.length === 1 ? "" : "s"}${section.data.intro ? "" : " · no introduction yet"}`;
  if (section.type === "geography") {
    const countries = new Set([...section.data.regions.flatMap((r) => r.countries), ...section.data.countries]).size;
    return countries ? `${section.data.regions.length} region${section.data.regions.length === 1 ? "" : "s"} · ${countries} countr${countries === 1 ? "y" : "ies"}` : "No countries yet";
  }
  return section.data.heading || "No heading yet";
}

const Lines = ({ label, item, add, items, max, maxLength, onChange, err, path, disabled, helper }: { label: string; item: string; add: string; items: string[]; max: number; maxLength: number; onChange: (items: string[]) => void; err: Err; path: string; disabled: boolean; helper?: string }) => (
  <ItemList
    label={label}
    items={items}
    max={max}
    disabled={disabled}
    error={err(path)}
    itemLabel={(i) => `${item} ${i + 1}`}
    addLabel={add}
    onChange={onChange}
    make={() => ""}
    render={(line, setLine, i) => <TextField label={`${item} ${i + 1}`} required helper={helper} max={maxLength} value={line} onChange={(v) => setLine(v ?? "")} error={err(`${path}.${i}`)} disabled={disabled} />}
  />
);

const EDITORS: { [T in ImpactBlockType]: (p: EditorProps<T>) => ReactNode } = {
  intro: ({ data, set, err, disabled }) => (
    <>
      <TextField label="Kicker" helper="Optional. A short label above the title." max={60} value={data.kicker} onChange={(kicker) => set(clean({ ...data, kicker }))} error={err("kicker")} disabled={disabled} />
      <TextField label="Page title" required helper="The page's main heading." max={120} value={data.title} onChange={(title) => set({ ...data, title: title ?? "" })} error={err("title")} disabled={disabled} />
      <TextField label="Highlight" helper="Optional. A word or phrase from the title to set on a highlight." max={60} value={data.highlight} onChange={(highlight) => set(clean({ ...data, highlight }))} error={err("highlight")} disabled={disabled} />
      <TextField label="Opening line" required multiline max={400} value={data.body} onChange={(body) => set({ ...data, body: body ?? "" })} error={err("body")} disabled={disabled} />
    </>
  ),
  stats: ({ data, set, err, disabled }) => (
    <>
      <p className={styles.help}>The figures themselves — values, labels and verification — are edited under Impact figures; the homepage names the same ones.</p>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <Body data={data} set={set} err={err} disabled={disabled} />
      <MetricsField value={data.metricIds} onChange={(metricIds) => set({ ...data, metricIds: metricIds as typeof data.metricIds })} error={err("metricIds")} disabled={disabled} />
      <TextField label="Source line" helper="Optional. Where the figures come from." max={300} value={data.source} onChange={(source) => set(clean({ ...data, source }))} error={err("source")} disabled={disabled} />
      <Cta data={data} set={set} err={err} disabled={disabled} />
    </>
  ),
  programImpact: ({ data, set, err, disabled }) => (
    <>
      <p className={styles.help}>Every program area is listed, from Programs. Write the change a program works towards here; a program without a line shows “to be provided”.</p>
      <TextField label="Kicker" helper="Optional. A short label above the heading." max={60} value={data.kicker} onChange={(kicker) => set(clean({ ...data, kicker }))} error={err("kicker")} disabled={disabled} />
      <TextField label="Heading" required max={160} value={data.heading} onChange={(heading) => set({ ...data, heading: heading ?? "" })} error={err("heading")} disabled={disabled} />
      <ItemList
        label="Program lines"
        items={data.items}
        max={12}
        disabled={disabled}
        error={err("items")}
        itemLabel={(i) => `Program line ${i + 1}`}
        addLabel="Add a program line"
        onChange={(items) => set({ ...data, items })}
        make={() => ({ programId: "", summary: "" })}
        render={(item, setItem, i) => (
          <div className={styles.fields}>
            <ProgramSelect label={`Program ${i + 1}`} required value={item.programId || undefined} onChange={(programId) => setItem({ ...item, programId: programId ?? "" })} error={err(`items.${i}.programId`)} disabled={disabled} />
            <TextField label="The change it works towards" required multiline max={300} value={item.summary} onChange={(summary) => setItem({ ...item, summary: summary ?? "" })} error={err(`items.${i}.summary`)} disabled={disabled} />
          </div>
        )}
      />
    </>
  ),
  teasers: ({ data, set, err, disabled }) => (
    <>
      <p className={styles.help}>Two posters side by side, each leading to another page.</p>
      {data.items.map((item, i) => {
        const e = sub(err, `items.${i}`);
        const setItem = (next: typeof item) => set({ ...data, items: data.items.map((x, j) => (j === i ? next : x)) as typeof data.items });
        return (
          <fieldset key={i} className={styles.group}>
            <legend className={styles.legend}>{i === 0 ? "First poster" : "Second poster"}</legend>
            <TextField label="Kicker" helper="Optional." max={60} value={item.kicker} onChange={(kicker) => setItem(clean({ ...item, kicker }))} error={e("kicker")} disabled={disabled} />
            <TextField label="Heading" required max={160} value={item.heading} onChange={(heading) => setItem({ ...item, heading: heading ?? "" })} error={e("heading")} disabled={disabled} />
            <TextField label="Text" required multiline max={600} value={item.body} onChange={(body) => setItem({ ...item, body: body ?? "" })} error={e("body")} disabled={disabled} />
            <LinkField label="Button" value={item.cta} onChange={(cta) => setItem({ ...item, cta: cta! })} error={sub(e, "cta")} disabled={disabled} />
          </fieldset>
        );
      })}
    </>
  ),
  measurement: ({ data, set, err, disabled }) => (
    <>
      <TextField label="Heading" required max={160} value={data.heading} onChange={(heading) => set({ ...data, heading: heading ?? "" })} error={err("heading")} disabled={disabled} />
      <TextField label="Text" multiline helper="Optional. The passage above the list." max={1200} value={data.body} onChange={(body) => set(clean({ ...data, body }))} error={err("body")} disabled={disabled} />
      <Lines label="What we look at" item="Line" add="Add a line" items={data.items} max={12} maxLength={300} onChange={(items) => set({ ...data, items })} err={err} path="items" disabled={disabled} />
    </>
  ),
  stories: ({ data, set, err, disabled }) => (
    <>
      <p className={styles.help}>Stories are chosen from Stories, in order. Only published stories can go live: a draft or archived one blocks publishing.</p>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <StoriesField label="Stories" value={data.storyIds} onChange={(storyIds) => set({ ...data, storyIds })} max={6} error={err("storyIds")} disabled={disabled} />
      <Cta data={data} set={set} err={err} disabled={disabled} />
    </>
  ),
  trust: ({ data, set, err, disabled }) => (
    <>
      <p className={styles.help}>The links beneath this statement come from Transparency: its financial overview, its published documents, governance and “How we report”.</p>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <Body data={data} set={set} err={err} disabled={disabled} />
      <Cta data={data} set={set} err={err} disabled={disabled} />
    </>
  ),
  approach: ({ data, set, err, disabled }) => (
    <>
      <p className={styles.help}>The words of the Our Approach page (/impact/our-approach). It opens with the mission from the About page’s Mission &amp; Vision block — edit it there. Leave a part empty and the page says it is still to be provided.</p>
      <TextField label="How we work" multiline helper="Optional. A short passage on how the work is done." max={1200} value={data.intro} onChange={(intro) => set(clean({ ...data, intro }))} error={err("intro")} disabled={disabled} />
      <Lines label="Our principles" item="Principle" add="Add a principle" items={data.principles} max={12} maxLength={300} onChange={(principles) => set({ ...data, principles })} err={err} path="principles" disabled={disabled} />
    </>
  ),
  geography: ({ data, set, err, disabled }) => (
    <>
      <p className={styles.help}>The Where We Work page (/impact/where-we-work). Select only countries Rising Beyond Borders has verified it works in — the list below is every country, not where RBB works, and nothing is selected until you select it. Never a sample, and never a figure such as “25 countries” turned into names. While nothing is selected the page shows no list and stays out of search engines. There is no map.</p>
      <TextField label="Summary" multiline helper="Optional. Replaces the page’s opening line." max={600} value={data.summary} onChange={(summary) => set(clean({ ...data, summary }))} error={err("summary")} disabled={disabled} />
      <ItemList
        label="Regions"
        items={data.regions}
        max={20}
        disabled={disabled}
        error={err("regions")}
        itemLabel={(i) => `Region ${i + 1}`}
        addLabel="Add a region"
        onChange={(regions) => set({ ...data, regions })}
        make={() => ({ id: "", name: "", countries: [] })}
        render={(region, setRegion, i) => (
          <div className={styles.fields}>
            <TextField label={`Region ${i + 1} name`} required max={120} value={region.name} onChange={(name) => setRegion({ ...region, name: name ?? "", id: regionId(name ?? "", data.regions.filter((_, j) => j !== i)) })} error={err(`regions.${i}.name`) ?? err(`regions.${i}.id`)} disabled={disabled} />
            <CountryPicker label={`Countries in region ${i + 1}`} helper="At least one." value={region.countries} onChange={(countries) => setRegion({ ...region, countries })} taken={takenElsewhere(data, i)} max={60} error={err(`regions.${i}.countries`) ?? firstError(err, `regions.${i}.countries`, region.countries.length)} disabled={disabled} />
          </div>
        )}
      />
      <CountryPicker label="Countries not in a region" helper="Optional." value={data.countries} onChange={(countries) => set({ ...data, countries })} taken={takenElsewhere(data, "ungrouped")} max={100} error={err("countries") ?? firstError(err, "countries", data.countries.length)} disabled={disabled} />
    </>
  ),
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

export function ImpactBlockEditor({ section, onChange, errors, disabled }: { section: ImpactSection; onChange: (section: ImpactSection) => void; errors: Map<string, string> | undefined; disabled: boolean }) {
  const Editor = EDITORS[section.type] as (p: EditorProps<ImpactBlockType>) => ReactNode;
  const err: Err = (path) => errors?.get(path);
  return (
    <div className={styles.fields}>
      {errors?.get("") && <p className={styles.error} role="alert">{errors.get("")}</p>}
      <Editor data={section.data as ImpactBlockData<ImpactBlockType>} set={(data) => onChange({ ...section, data } as ImpactSection)} err={err} disabled={disabled} />
    </div>
  );
}
