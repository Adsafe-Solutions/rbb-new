import { useCallback, type ReactNode } from "react";
import { FormField, Input, Select } from "../design-system";
import { appealsApi, eventsApi, postsApi } from "../content/client";
import type { BlockData, BlockType, HomepageSection } from "./client";
import { Body, Cta, HeadingFields, ImageField, ItemList, LinkField, ParagraphsField, RecordPicker, TextField, clean, sub, type PickableRecord } from "../blocks/fields";
import { MetricsField } from "../impact/MetricsField";
import { ProgramSelect } from "../content/pickers";
import styles from "../blocks/blocks.module.css";

/* One block's editor: typed fields for exactly its contract data. The
   EDITORS table is explicit — type → form — like the website's renderers.
   Fields the website does not draw (the call to action's photographs, the
   get-involved photographs) keep their stored values and are not shown. */

type Err = (path: string) => string | undefined;
interface EditorProps<T extends BlockType> {
  data: BlockData<T>;
  set: (data: BlockData<T>) => void;
  err: Err;
  disabled: boolean;
}

const records = (list: (p: { pageSize: number; sort: "updated" }) => Promise<{ items: { record: { id: string; title: string; status: string; slug: string }; live: boolean }[] }>, detail?: (r: Record<string, unknown>) => string) => () =>
  list({ pageSize: 100, sort: "updated" }).then((r) => r.items.filter((v) => v.record.status !== "archived").map((v): PickableRecord => ({ id: v.record.id, title: v.record.title, status: v.record.status, live: v.live, detail: detail?.(v.record as unknown as Record<string, unknown>) })));

const EDITORS: { [T in BlockType]: (p: EditorProps<T>) => ReactNode } = {
  hero: ({ data, set, err, disabled }) => (
    <>
      <ItemList
        label="Slides"
        items={data.slides}
        max={6}
        disabled={disabled}
        error={err("slides")}
        itemLabel={(i) => `Slide ${i + 1}`}
        onChange={(slides) => set({ ...data, slides: slides as typeof data.slides })}
        make={() => ({ id: `slide-${crypto.randomUUID().slice(0, 6)}`, headline: [""], cta: { label: "", href: "" }, imageId: "", insetId: "" })}
        render={(slide, setSlide, i) => (
          <div className={styles.fields}>
            {[0, 1, 2].map((line) => (
              <TextField
                key={line}
                label={`Headline line ${line + 1}`}
                required={line === 0}
                helper={line === 0 ? "Up to three short lines; the last word takes the highlight." : "Optional."}
                max={40}
                value={slide.headline[line]}
                onChange={(v) => {
                  const lines = [...slide.headline];
                  lines[line] = v ?? "";
                  setSlide({ ...slide, headline: lines.slice(0, 3).filter((l, k) => k === 0 || l !== "") as typeof slide.headline });
                }}
                error={err(`slides.${i}.headline.${line}`) ?? (line === 0 ? err(`slides.${i}.headline`) : undefined)}
                disabled={disabled}
              />
            ))}
            <LinkField label="Slide button" value={slide.cta} onChange={(cta) => setSlide({ ...slide, cta: cta! })} error={sub(err, `slides.${i}.cta`)} disabled={disabled} />
            <ImageField label={`Slide ${i + 1} photograph`} value={slide.imageId} onChange={(imageId) => setSlide({ ...slide, imageId: imageId ?? "" })} error={err(`slides.${i}.imageId`)} disabled={disabled} />
            <ImageField label={`Slide ${i + 1} inset photograph`} value={slide.insetId} onChange={(insetId) => setSlide({ ...slide, insetId: insetId ?? "" })} error={err(`slides.${i}.insetId`)} disabled={disabled} />
          </div>
        )}
      />
      <LinkField label="Second button (every slide)" value={data.secondaryCta} onChange={(secondaryCta) => set({ ...data, secondaryCta: secondaryCta! })} error={sub(err, "secondaryCta")} disabled={disabled} />
      <FormField label="Seconds per slide" helper="3 to 20." error={err("intervalMs")} disabled={disabled}>
        <Input type="number" min={3} max={20} value={Math.round(data.intervalMs / 1000)} onChange={(e) => set({ ...data, intervalMs: Number(e.target.value) * 1000 })} />
      </FormField>
    </>
  ),
  imageText: ({ data, set, err, disabled }) => (
    <>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <ParagraphsField label="Paragraphs" value={data.body} onChange={(body) => set({ ...data, body: body as typeof data.body })} error={err("body") ?? err("body.0")} disabled={disabled} />
      <ImageField label="Photograph" value={data.imageId} onChange={(imageId) => set({ ...data, imageId: imageId ?? "" })} error={err("imageId")} disabled={disabled} />
      <FormField label="Photograph side" disabled={disabled}>
        <Select options={[{ value: "right", label: "Right of the text" }, { value: "left", label: "Left of the text" }]} value={data.imagePosition ?? "right"} onChange={(e) => set({ ...data, imagePosition: e.target.value === "left" ? "left" : undefined })} />
      </FormField>
      <Cta data={data} set={set} err={err} disabled={disabled} />
      <LinkField label="Second link" optional value={data.secondaryCta} onChange={(secondaryCta) => set(clean({ ...data, secondaryCta }))} error={sub(err, "secondaryCta")} disabled={disabled} />
    </>
  ),
  programs: ({ data, set, err, disabled }) => (
    <>
      <p className={styles.help}>The cards are the program areas themselves; the heading, a line and a link are set here.</p>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <Body data={data} set={set} err={err} disabled={disabled} />
      <Cta data={data} set={set} err={err} disabled={disabled} />
    </>
  ),
  approach: ({ data, set, err, disabled }) => (
    <>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <Body data={data} set={set} err={err} disabled={disabled} label="Statement" />
      <Cta data={data} set={set} err={err} disabled={disabled} />
    </>
  ),
  stats: ({ data, set, err, disabled }) => (
    <>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <Body data={data} set={set} err={err} disabled={disabled} />
      <MetricsField value={data.metricIds} onChange={(metricIds) => set({ ...data, metricIds: metricIds as typeof data.metricIds })} error={err("metricIds")} disabled={disabled} />
      <TextField label="Source line" helper="Optional. Where the figures come from." max={300} value={data.source} onChange={(source) => set(clean({ ...data, source }))} error={err("source")} disabled={disabled} />
      <Cta data={data} set={set} err={err} disabled={disabled} />
    </>
  ),
  timeline: ({ data, set, err, disabled }) => (
    <>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <Body data={data} set={set} err={err} disabled={disabled} />
      <Cta data={data} set={set} err={err} disabled={disabled} />
      <ItemList
        label="Milestones"
        items={data.items}
        max={12}
        disabled={disabled}
        itemLabel={(i) => `Milestone ${i + 1}`}
        onChange={(items) => set({ ...data, items })}
        make={() => ({ id: `milestone-${crypto.randomUUID().slice(0, 6)}`, date: "", programId: "", title: "", summary: "", youtubeId: "", videoTitle: "", posterId: "" })}
        render={(item, setItem, i) => (
          <div className={styles.fields}>
            <div className={styles.row}>
              <FormField label="Date" required error={err(`items.${i}.date`)} disabled={disabled}>
                <Input type="date" value={item.date} onChange={(e) => setItem({ ...item, date: e.target.value })} />
              </FormField>
              <ProgramSelect label="Program" required value={item.programId || undefined} onChange={(programId) => setItem({ ...item, programId: programId ?? "" })} error={err(`items.${i}.programId`)} disabled={disabled} />
            </div>
            <TextField label="Title" required max={120} value={item.title} onChange={(title) => setItem({ ...item, title: title ?? "" })} error={err(`items.${i}.title`)} disabled={disabled} />
            <TextField label="One line" required multiline max={300} value={item.summary} onChange={(summary) => setItem({ ...item, summary: summary ?? "" })} error={err(`items.${i}.summary`)} disabled={disabled} />
            <div className={styles.row}>
              <TextField label="YouTube video id" required helper="The 11 characters after v= or /shorts/." max={11} value={item.youtubeId} onChange={(youtubeId) => setItem({ ...item, youtubeId: youtubeId ?? "" })} error={err(`items.${i}.youtubeId`)} disabled={disabled} />
              <TextField label="Video title" required max={160} value={item.videoTitle} onChange={(videoTitle) => setItem({ ...item, videoTitle: videoTitle ?? "" })} error={err(`items.${i}.videoTitle`)} disabled={disabled} />
            </div>
            <ImageField label={`Milestone ${i + 1} poster`} value={item.posterId} onChange={(posterId) => setItem({ ...item, posterId: posterId ?? "" })} error={err(`items.${i}.posterId`)} disabled={disabled} />
          </div>
        )}
      />
    </>
  ),
  stories: ({ data, set, err, disabled }) => (
    <>
      <p className={styles.help}>Shows the newest published stories.</p>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <Body data={data} set={set} err={err} disabled={disabled} />
      <FormField label="How many stories" helper="1 to 6." error={err("count")} disabled={disabled}>
        <Input type="number" min={1} max={6} value={data.count} onChange={(e) => set({ ...data, count: Number(e.target.value) })} />
      </FormField>
      <Cta data={data} set={set} err={err} disabled={disabled} />
    </>
  ),
  video: ({ data, set, err, disabled }) => (
    <>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <Body data={data} set={set} err={err} disabled={disabled} />
      <div className={styles.row}>
        <TextField label="YouTube video id" required helper="The 11 characters after v=." max={11} value={data.youtubeId} onChange={(youtubeId) => set({ ...data, youtubeId: youtubeId ?? "" })} error={err("youtubeId")} disabled={disabled} />
        <TextField label="Video title" required max={160} value={data.title} onChange={(title) => set({ ...data, title: title ?? "" })} error={err("title")} disabled={disabled} />
      </div>
      <ImageField label="Poster" helper="Required. Shown until the film is played — nothing loads from YouTube before that." value={data.posterId} onChange={(posterId) => set({ ...data, posterId: posterId ?? "" })} error={err("posterId")} disabled={disabled} />
    </>
  ),
  trust: ({ data, set, err, disabled }) => (
    <>
      <p className={styles.help}>The transparency documents beneath it come from the website&apos;s transparency records.</p>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <Body data={data} set={set} err={err} disabled={disabled} />
      <Cta data={data} set={set} err={err} disabled={disabled} />
    </>
  ),
  getInvolved: ({ data, set, err, disabled }) => (
    <>
      <p className={styles.help}>The ways to take part are the Get Involved pages themselves.</p>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <Body data={data} set={set} err={err} disabled={disabled} />
      <Cta data={data} set={set} err={err} disabled={disabled} />
    </>
  ),
  faq: ({ data, set, err, disabled }) => (
    <>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <ItemList
        label="Questions"
        items={data.items}
        max={30}
        disabled={disabled}
        error={err("items")}
        itemLabel={(i) => `Question ${i + 1}`}
        onChange={(items) => set({ ...data, items: items as typeof data.items })}
        make={() => ({ question: "", answer: "" })}
        render={(item, setItem, i) => (
          <div className={styles.fields}>
            <TextField label="Question" required max={300} value={item.question} onChange={(question) => setItem({ ...item, question: question ?? "" })} error={err(`items.${i}.question`)} disabled={disabled} />
            <TextField label="Answer" required multiline max={3000} value={item.answer} onChange={(answer) => setItem({ ...item, answer: answer ?? "" })} error={err(`items.${i}.answer`)} disabled={disabled} />
          </div>
        )}
      />
    </>
  ),
  cta: ({ data, set, err, disabled }) => (
    <>
      <TextField label="Heading" required max={160} value={data.heading} onChange={(heading) => set({ ...data, heading: heading ?? "" })} error={err("heading")} disabled={disabled} />
      <TextField label="Highlight" helper="Optional. A word or phrase from the heading." max={60} value={data.highlight} onChange={(highlight) => set(clean({ ...data, highlight }))} error={err("highlight")} disabled={disabled} />
      <Body data={data} set={set} err={err} disabled={disabled} />
      <LinkField label="Main button" value={data.primary} onChange={(primary) => set({ ...data, primary: primary! })} error={sub(err, "primary")} disabled={disabled} />
      <LinkField label="Second button" optional value={data.secondary} onChange={(secondary) => set(clean({ ...data, secondary }))} error={sub(err, "secondary")} disabled={disabled} />
    </>
  ),
  appealList: (props) => <AppealListEditor {...props} />,
  postList: (props) => <PostListEditor {...props} />,
  eventList: (props) => <EventListEditor {...props} />,
};

function AppealListEditor({ data, set, err, disabled }: EditorProps<"appealList">) {
  const load = useCallback(records(appealsApi.list, (r) => (r.kind === "campaign" ? "Campaign" : r.kind === "special" ? "Special appeal" : "Emergency appeal")), []);
  const mode = data.appealIds ? "chosen" : "all";
  return (
    <>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <FormField label="Which appeals" disabled={disabled}>
        <Select
          options={[
            { value: "chosen", label: "Appeals I choose" },
            { value: "all", label: "Every published appeal" },
          ]}
          value={mode}
          onChange={(e) => set(clean({ ...data, appealIds: e.target.value === "chosen" ? ([] as unknown as typeof data.appealIds) : undefined }))}
        />
      </FormField>
      {mode === "chosen" ? (
        <RecordPicker label="Appeals" load={load} value={data.appealIds ?? []} onChange={(ids) => set({ ...data, appealIds: ids as typeof data.appealIds })} max={6} disabled={disabled} error={err("appealIds")} />
      ) : (
        <FormField label="Kind" disabled={disabled}>
          <Select options={[{ value: "", label: "Every appeal" }, { value: "emergency", label: "Emergency appeals" }, { value: "campaign", label: "Campaigns" }, { value: "special", label: "Special appeals" }]} value={data.kind ?? ""} onChange={(e) => set(clean({ ...data, kind: (e.target.value || undefined) as typeof data.kind }))} />
        </FormField>
      )}
      <Cta data={data} set={set} err={err} disabled={disabled} />
    </>
  );
}

function PostListEditor({ data, set, err, disabled }: EditorProps<"postList">) {
  const load = useCallback(records(postsApi.list, (r) => (r.type === "blog" ? "Blog" : "News")), []);
  return (
    <>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <RecordPicker label="Posts" load={load} value={data.postIds} onChange={(ids) => set({ ...data, postIds: ids as typeof data.postIds })} max={6} disabled={disabled} error={err("postIds")} />
      <Cta data={data} set={set} err={err} disabled={disabled} />
    </>
  );
}

function EventListEditor({ data, set, err, disabled }: EditorProps<"eventList">) {
  const load = useCallback(records(eventsApi.list, (r) => String(r.date ?? "")), []);
  return (
    <>
      <HeadingFields data={data} set={set} err={err} disabled={disabled} />
      <RecordPicker label="Events" load={load} value={data.eventIds} onChange={(ids) => set({ ...data, eventIds: ids as typeof data.eventIds })} max={6} disabled={disabled} error={err("eventIds")} />
      <Cta data={data} set={set} err={err} disabled={disabled} />
    </>
  );
}

export function BlockEditor({ section, onChange, errors, disabled }: { section: HomepageSection; onChange: (section: HomepageSection) => void; errors: Map<string, string> | undefined; disabled: boolean }) {
  const Editor = EDITORS[section.type] as (p: EditorProps<BlockType>) => ReactNode;
  const err: Err = (path) => errors?.get(path);
  return (
    <div className={styles.fields}>
      {errors?.get("") && <p className={styles.error} role="alert">{errors.get("")}</p>}
      <Editor data={section.data as BlockData<BlockType>} set={(data) => onChange({ ...section, data } as HomepageSection)} err={err} disabled={disabled} />
    </div>
  );
}
