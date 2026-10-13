import CmsAbout from "./CmsAbout.jsx";
import { PUBLISHED_ABOUT } from "../../content/index.js";

/* /about: the blocks RBB published in the CMS, in their order
   (pages/About/CmsAbout.jsx). 2026-10-13: the website keeps no built-in
   About page of its own — the build refuses a snapshot without one
   (scripts/published-snapshot.mjs), so `page` is always there in a real
   build; a test that applies no snapshot gets an empty page. */
export default function About() {
  return PUBLISHED_ABOUT.page ? <CmsAbout page={PUBLISHED_ABOUT.page} /> : null;
}
