import { z } from "zod";
import { text } from "./primitives.ts";

/* Where a link may point. Exactly the kinds the website uses:

     /path, /path#section, /path?query   a page of this site
     #section                            a section of the current page
     https://…                           another site (https only)
     mailto:…  tel:…                     a contact method

   Everything else is refused — javascript:, data:, vbscript:, plain
   http:, protocol-relative //host and any other scheme. */
const INTERNAL = /^\/(?!\/)[^\s\\]*$/;
const FRAGMENT = /^#[A-Za-z][\w-]*$/;
const MAILTO = /^mailto:[^\s@]+@[^\s@]+$/i;
const TEL = /^tel:\+?[0-9][0-9 ()-]{4,}$/;

const isHttpsUrl = (value: string): boolean => {
  if (!/^https:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0 && !url.username && !url.password;
  } catch {
    return false;
  }
};

export const isSafeHref = (value: string): boolean =>
  INTERNAL.test(value) || FRAGMENT.test(value) || MAILTO.test(value) || TEL.test(value) || isHttpsUrl(value);

export const Href = z.string().max(2048).refine(isSafeHref, "must be a site path, #section, https:// URL, mailto: or tel:");

/* An address on another site, https only (maps, social accounts,
   registration pages). */
export const HttpsUrl = z.string().max(2048).refine(isHttpsUrl, "must be an https:// URL");

/* A path on this site, without query or fragment ("/contact"). */
export const InternalPath = z.string().regex(/^\/(?!\/)[^\s?#\\]*$/, 'must be a site path like "/contact"');

/* A labelled link — a button or a text link. Whether it is drawn as a
   button, an arrow link or a card is the page's decision, not the
   content's. */
export const Link = z.strictObject({
  label: text(80),
  href: Href,
});
export type Link = z.infer<typeof Link>;
