import CmsImpact from "./CmsImpact.jsx";
import { PUBLISHED_IMPACT } from "../../content/index.js";

/* /impact: the blocks RBB published in the CMS, in their order
   (pages/Impact/CmsImpact.jsx). 2026-10-13: the website keeps no built-in
   Impact page of its own — the build refuses a snapshot without one
   (scripts/published-snapshot.mjs), so `page` is always there in a real
   build; a test that applies no snapshot gets an empty page. */
export default function Impact() {
  return PUBLISHED_IMPACT.page ? <CmsImpact page={PUBLISHED_IMPACT.page} /> : null;
}
