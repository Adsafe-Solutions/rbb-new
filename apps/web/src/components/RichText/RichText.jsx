import { Fragment } from "react";
import { Link } from "react-router-dom";

/* Structured rich text (packages/content-schema RichText) → elements this
   component controls. Every node type maps to one element and nothing else
   can appear: no HTML is ever interpreted, so there is nothing to
   sanitize. Used for published posts and events from the CMS snapshot;
   source content stays plain paragraphs.

   Classes are the site's existing ones (headings like card titles, the
   lists of the policy and transparency pages, the inline link style), so a
   rich-text page looks like the rest of the site. */

const LINK = "font-bold text-fg underline decoration-2 underline-offset-4";

function Inline({ nodes }) {
  return nodes.map((node, i) => {
    if (node.type === "link") {
      const children = <Inline nodes={node.children} />;
      return node.href.startsWith("/") ? (
        <Link key={i} to={node.href} className={LINK}>
          {children}
        </Link>
      ) : (
        <a key={i} href={node.href} className={LINK} {...(/^https:/.test(node.href) && { rel: "noopener noreferrer" })}>
          {children}
        </a>
      );
    }
    const marks = new Set(node.marks ?? []);
    let out = node.text;
    if (marks.has("italic")) out = <em>{out}</em>;
    if (marks.has("bold")) out = <strong>{out}</strong>;
    /* No wrapper: a paragraph of plain text is exactly the source's <p>. */
    return <Fragment key={i}>{out}</Fragment>;
  });
}

/* One block. `paragraphClass(i)` keeps each page's own paragraph styling
   (an article's opening drop cap, an event's measure). */
export function RichBlock({ block, index, paragraphClass }) {
  if (block.type === "heading") {
    const Tag = block.level === 2 ? "h2" : "h3";
    return (
      <Tag className={block.level === 2 ? "type-card mt-10 text-fg" : "type-card mt-8 text-fg"}>
        <Inline nodes={block.children} />
      </Tag>
    );
  }
  if (block.type === "list") {
    const items = block.items.map((item, i) => (
      <li key={i}>
        <Inline nodes={item} />
      </li>
    ));
    return block.style === "ordered" ? <ol className="mt-4 grid list-decimal gap-2 pl-5 text-copy">{items}</ol> : <ul className="mt-4 list-disc space-y-2 pl-6 text-copy marker:text-trust-blue">{items}</ul>;
  }
  return (
    <p className={paragraphClass(index)}>
      <Inline nodes={block.children} />
    </p>
  );
}
