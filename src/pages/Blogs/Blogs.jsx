import BlogGrid from "../../components/BlogGrid/BlogGrid.jsx";
import useReveal from "../../hooks/useReveal.js";
import { BLOGS } from "../../content/index.js";

/* /blogs — the index. Individual posts fall through to the stub until
   there is a CMS to read them from. */
export default function Blogs() {
  useReveal();

  return <BlogGrid {...BLOGS} />;
}
