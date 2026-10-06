import { createContext, useContext, useEffect } from "react";
import { documentTitle, seoTags } from "../content/seo.js";

/* Writes one route's metadata (content/seo.js) into <head>: the title,
   description, robots, canonical, Open Graph, X card and JSON-LD.

   Two environments, one list of tags (`seoTags`):

   - In the browser, an effect writes them into the DOM. Every tag this
     hook owns carries `data-seo`, and a null value REMOVES the tag — so
     leaving a story for a page with no image does not leave the story's
     image behind as the next page's og:image. The pre-rendered page's
     tags carry `data-seo` too, so hydration takes them over in place.

   - During the build's pre-render (entry-server.jsx) effects never run,
     so the record is handed to `SeoCollector` DURING render and written
     into the page's HTML <head> by scripts/prerender.mjs.

   React 18 has no <head> management of its own, and this does not
   justify a library. */
export const SeoCollector = createContext(null);

const HEAD = () => document.head;

function setMeta(attr, key, value) {
  let el = HEAD().querySelector(`meta[${attr}="${key}"]`);
  if (value == null || value === "") {
    if (el?.dataset.seo !== undefined) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    el.dataset.seo = "";
    HEAD().appendChild(el);
  }
  el.setAttribute("content", value);
}

function setLink(rel, href) {
  let el = HEAD().querySelector(`link[rel="${rel}"]`);
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    el.dataset.seo = "";
    HEAD().appendChild(el);
  }
  el.href = href;
}

function setJsonLd(value) {
  HEAD().querySelector('script[type="application/ld+json"][data-seo]')?.remove();
  if (!value) return;
  const el = document.createElement("script");
  el.type = "application/ld+json";
  el.dataset.seo = "";
  el.textContent = JSON.stringify(value);
  HEAD().appendChild(el);
}

export default function useSeo(meta) {
  /* Pre-render: the innermost page's record wins, because render runs
     parent → child. In the browser the effects run child → parent, so
     the outermost wins there — no route sets both, so they agree. */
  const collector = useContext(SeoCollector);
  if (collector) collector.meta = meta;

  useEffect(() => {
    document.title = documentTitle(meta.title);
    for (const tag of seoTags(meta)) {
      if (tag.link) setLink(tag.link, tag.value);
      else if (tag.jsonLd) setJsonLd(tag.value);
      else setMeta(tag.attr, tag.key, tag.value);
    }
    // One key for the whole record: it changes exactly when the route does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(meta)]);
}
