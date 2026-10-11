/* Rich text for the editor: the content contract's RichText as JSON, and
   the plain-text form each block is typed in. No HTML anywhere.

   Blocks (one text box each):  paragraph · heading 2 · heading 3 ·
                                bulleted list · numbered list (one item per line)
   Inline, inside any block:    **bold**   *italic*   ***both***
                                [link text](https://… | /a-page | #section | mailto: | tel:)
   A literal *, [, ], (, ) or \ is typed with a backslash before it.

   parseInline / serializeInline are exact inverses for anything the
   contract can hold, so opening and saving a record never changes it.
   Self-contained (no imports): it is unit-tested directly by Node. */

export type Mark = "bold" | "italic";
export interface TextNode {
  type: "text";
  text: string;
  marks?: Mark[];
}
export interface LinkNode {
  type: "link";
  href: string;
  children: TextNode[];
}
export type Inline = TextNode | LinkNode;
export type Block =
  | { type: "paragraph"; children: Inline[] }
  | { type: "heading"; level: 2 | 3; children: Inline[] }
  | { type: "list"; style: "bullet" | "ordered"; items: Inline[][] };
export type RichText = Block[];

export type BlockKind = "paragraph" | "heading2" | "heading3" | "bullet" | "ordered";
export interface EditableBlock {
  kind: BlockKind;
  /* The typed text (list items one per line). */
  text: string;
}

const SPECIAL = /[\\*[\]()]/g;
const escape = (text: string) => text.replace(SPECIAL, (c) => `\\${c}`);

function serializeText(node: TextNode): string {
  const marks = new Set(node.marks ?? []);
  const fence = marks.has("bold") && marks.has("italic") ? "***" : marks.has("bold") ? "**" : marks.has("italic") ? "*" : "";
  if (!fence) return escape(node.text);
  // Spaces stay outside the fences, where the parser expects them.
  const [, lead, core, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(node.text)!;
  return core ? `${lead}${fence}${escape(core)}${fence}${trail}` : escape(node.text);
}

export function serializeInline(nodes: Inline[]): string {
  return nodes.map((n) => (n.type === "link" ? `[${n.children.map(serializeText).join("")}](${n.href.replace(/[()\\\s]/g, (c) => `\\${c}`)})` : serializeText(n))).join("");
}

/* Text with bold, italic or bold-italic fences → text nodes. Unclosed fences stay literal. */
function parseMarks(source: string): TextNode[] {
  const out: TextNode[] = [];
  let buffer = "";
  let marks: Mark[] = [];
  const flush = () => {
    if (buffer) out.push(marks.length ? { type: "text", text: buffer, marks: [...marks] } : { type: "text", text: buffer });
    buffer = "";
  };
  for (let i = 0; i < source.length; ) {
    const c = source[i]!;
    if (c === "\\" && i + 1 < source.length) {
      buffer += source[i + 1];
      i += 2;
      continue;
    }
    if (c === "*") {
      const run = /^\*{1,3}/.exec(source.slice(i))![0];
      const want: Mark[] = run.length === 3 ? ["bold", "italic"] : run.length === 2 ? ["bold"] : ["italic"];
      if (marks.length) {
        // Close with exactly the open fence's length; any further asterisks
        // start the next run ("*x***y**" is italic x, then bold y).
        const need = marks.length === 2 ? 3 : marks[0] === "bold" ? 2 : 1;
        // A fence closes only right after text, never after a space.
        if (run.length >= need && buffer && !/\s$/.test(buffer)) {
          flush();
          marks = [];
          i += need;
          continue;
        }
        buffer += run;
      } else if (/\S/.test(source[i + run.length] ?? "") && source.indexOf(run, i + run.length) > i + run.length) {
        // A fence opens only right before text ("2 * 3" stays literal).
        flush();
        marks = want;
      } else buffer += run;
      i += run.length;
      continue;
    }
    buffer += c;
    i++;
  }
  if (marks.length) {
    // An unclosed fence: give the text back as typed.
    const fence = marks.length === 2 ? "***" : marks[0] === "bold" ? "**" : "*";
    buffer = fence + buffer;
    marks = [];
  }
  flush();
  // Merge neighbours with the same marks (e.g. split by an escape).
  return out.reduce<TextNode[]>((acc, n) => {
    const last = acc[acc.length - 1];
    if (last && JSON.stringify(last.marks ?? []) === JSON.stringify(n.marks ?? [])) last.text += n.text;
    else acc.push({ ...n });
    return acc;
  }, []);
}

export function parseInline(source: string): Inline[] {
  const nodes: Inline[] = [];
  let rest = "";
  const flush = () => {
    if (rest) nodes.push(...parseMarks(rest));
    rest = "";
  };
  for (let i = 0; i < source.length; ) {
    if (source[i] === "\\" && i + 1 < source.length) {
      rest += source.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (source[i] === "[") {
      // [label](href) — label may hold escapes and marks, href no spaces.
      let j = i + 1;
      while (j < source.length && source[j] !== "]") j += source[j] === "\\" ? 2 : 1;
      // ](href) — the address ends at the first unescaped ")".
      if (j < source.length && source[j + 1] === "(") {
        let k = j + 2;
        let href = "";
        while (k < source.length && source[k] !== ")") {
          if (source[k] === "\\" && k + 1 < source.length) {
            href += source[k + 1];
            k += 2;
          } else if (/[\s(]/.test(source[k]!)) break;
          else href += source[k++];
        }
        if (k < source.length && source[k] === ")" && href) {
          flush();
          const children = parseMarks(source.slice(i + 1, j));
          if (children.length) nodes.push({ type: "link", href, children });
          i = k + 1;
          continue;
        }
      }
    }
    rest += source[i];
    i++;
  }
  flush();
  return nodes;
}

export function toEditable(doc: RichText | undefined): EditableBlock[] {
  if (!doc?.length) return [{ kind: "paragraph", text: "" }];
  return doc.map((block): EditableBlock => {
    if (block.type === "paragraph") return { kind: "paragraph", text: serializeInline(block.children) };
    if (block.type === "heading") return { kind: block.level === 2 ? "heading2" : "heading3", text: serializeInline(block.children) };
    return { kind: block.style === "bullet" ? "bullet" : "ordered", text: block.items.map(serializeInline).join("\n") };
  });
}

/* Empty blocks and empty list lines are dropped: the contract has no
   empty nodes. */
export function fromEditable(blocks: EditableBlock[]): RichText {
  const out: RichText = [];
  for (const b of blocks) {
    if (b.kind === "bullet" || b.kind === "ordered") {
      const items = b.text.split("\n").map((line) => parseInline(line.trim())).filter((i) => i.length);
      if (items.length) out.push({ type: "list", style: b.kind === "bullet" ? "bullet" : "ordered", items });
      continue;
    }
    const children = parseInline(b.text.replace(/\s*\n\s*/g, " ").trim());
    if (!children.length) continue;
    out.push(b.kind === "paragraph" ? { type: "paragraph", children } : { type: "heading", level: b.kind === "heading2" ? 2 : 3, children });
  }
  return out;
}

/* The same link rule as the contract's Href, for instant feedback (the
   API is the authority). */
export function isSafeHref(value: string): boolean {
  if (/^\/(?!\/)[^\s\\]*$/.test(value) || /^#[A-Za-z][\w-]*$/.test(value) || /^mailto:[^\s@]+@[^\s@]+$/i.test(value) || /^tel:\+?[0-9][0-9 ()-]{4,}$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const unsafeLinks = (doc: RichText): string[] =>
  doc.flatMap((b) => (b.type === "list" ? b.items.flat() : b.children)).filter((n): n is LinkNode => n.type === "link" && !isSafeHref(n.href)).map((n) => n.href);
