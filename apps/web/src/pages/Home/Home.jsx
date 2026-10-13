import CmsHome from "./CmsHome.jsx";
import { PUBLISHED_HOMEPAGE } from "../../content/index.js";

/* The homepage: the blocks RBB published in the CMS, in their order
   (pages/Home/CmsHome.jsx). 2026-10-13: the website keeps no built-in
   homepage of its own — the build refuses a snapshot without one
   (scripts/published-snapshot.mjs), so `page` is always there in a real
   build; a test that applies no snapshot gets an empty page. */
export default function Home() {
  return PUBLISHED_HOMEPAGE.page ? <CmsHome page={PUBLISHED_HOMEPAGE.page} /> : null;
}
