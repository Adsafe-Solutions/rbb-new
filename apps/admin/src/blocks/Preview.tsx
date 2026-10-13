import { useEffect, useState } from "react";
import { Alert } from "../design-system";
import { mediaApi } from "../media/client";
import type { Block, BlockInfo } from "./blocks";
import styles from "./blocks.module.css";

/* A draft preview of a block page (homepage, About), for the editor only:
   the ENABLED blocks in their order, numbered as the website numbers
   them, with their words and photographs. It is drawn here from the
   unsaved draft and is never published, served or indexed — the website
   is built only from what an owner publishes. */

export interface PreviewOptions {
  /* "Homepage", "About page": names the outline for screen readers. */
  title: string;
  info: (type: string) => BlockInfo;
  /* Block types the website does not number (an introduction, a closing ask). */
  unnumbered: ReadonlySet<string>;
  /* The block's photographs, by media id. */
  imagesOf: (block: Block) => string[];
  /* The block's headline, when it is not `data.heading`. */
  headingOf?: (block: Block) => string | undefined;
  /* How many records a block chose, when it chooses some. */
  countOf?: (block: Block) => number | undefined;
  /* Block types that hold another page's words and are not drawn on this
     one (the Impact page's Our Approach and Where We Work, #5/#6). */
  elsewhere?: ReadonlySet<string>;
}

function Thumb({ id }: { id: string }) {
  const [src, setSrc] = useState<{ url: string; alt: string } | null>(null);
  useEffect(() => {
    let live = true;
    if (id) mediaApi.get(id).then((m) => live && m.publicUrl && setSrc({ url: m.publicUrl, alt: m.alt }), () => {});
    return () => {
      live = false;
    };
  }, [id]);
  return src ? <img className={styles.thumb} src={src.url} alt={src.alt} loading="lazy" /> : <span className={styles.thumbEmpty} aria-hidden="true" />;
}

export function Preview({ sections, options }: { sections: Block[]; options: PreviewOptions }) {
  const enabled = sections.filter((s) => s.enabled);
  const shown = enabled.filter((s) => !options.elsewhere?.has(s.type));
  const away = enabled.filter((s) => options.elsewhere?.has(s.type));
  const hidden = sections.length - enabled.length;
  let n = 0;
  return (
    <div className={styles.preview}>
      <Alert tone="info">Draft preview — only here, in the admin. It is not the website and is never published; the website changes only when an owner publishes.</Alert>
      {hidden > 0 && <p className={styles.help}>{hidden} hidden block{hidden === 1 ? " is" : "s are"} not shown.</p>}
      {away.length > 0 && <p className={styles.help}>Not on this page — {away.map((s) => options.info(s.type).label).join(", ")}: {away.length === 1 ? "it holds" : "they hold"} the words of {away.length === 1 ? "its own page" : "their own pages"}.</p>}
      {shown.length === 0 && <p className={styles.help}>No blocks are shown yet.</p>}
      <ol className={styles.bands} aria-label={`${options.title} draft, top to bottom`}>
        {shown.map((s) => {
          const d = s.data as Record<string, unknown>;
          const numbered = !options.unnumbered.has(s.type);
          const heading = options.headingOf?.(s) ?? (d.heading as string | undefined);
          const count = options.countOf?.(s);
          return (
            <li key={s.id} className={styles.band} data-type={s.type}>
              <p className={styles.bandMeta}>
                {numbered && <span>{String(++n).padStart(2, "0")}</span>} {options.info(s.type).label}
                {typeof d.kicker === "string" && <span> · {d.kicker}</span>}
              </p>
              <p className={styles.bandHeading}>{heading || "No heading yet"}</p>
              {typeof d.body === "string" && <p className={styles.bandBody}>{d.body}</p>}
              {Array.isArray(d.body) && <p className={styles.bandBody}>{(d.body as string[]).join(" ")}</p>}
              {count !== undefined && <p className={styles.help}>{count} chosen</p>}
              {options.imagesOf(s).filter(Boolean).length > 0 && (
                <div className={styles.thumbs}>
                  {options.imagesOf(s).filter(Boolean).slice(0, 6).map((id, i) => (
                    <Thumb key={`${id}-${i}`} id={id} />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
