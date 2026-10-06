/* A word or two of a headline on a block of the accent — the system's
   signature device. The styling, and the contrast reasoning behind it,
   is `.hl` in styles/index.css.

   ⚠ A COMPOSITIONAL DECISION, NOT A RULE. It used to fall on the last
   word of every inner page's <h1> automatically, and on a page with five
   highlighted headings the device stopped meaning anything. Now a
   heading opts in, and says which words:

     withHighlight(text, "people")   the phrase, wherever it is (first
                                     match, case-insensitive); the words
                                     around it are untouched
     withHighlight(text, 2)          the last two words

   Prefer ONE word. The block is an inline-block (it must not overpaint
   the line above on display leading), so a two-word phrase that wraps
   on a phone becomes a two-line slab.

   A phrase that is not in the text — the content changed — leaves the
   heading plain rather than highlighting the wrong word. A heading that
   would be ALL highlight is left plain too: that is just a coloured box.

   The choice lives where the composition is decided (the page or the
   section), not in src/content: the copy stays plain words. */
export default function HighlightText({ children }) {
  return <span className="hl">{children}</span>;
}

export function withHighlight(text, highlight) {
  if (!highlight || typeof text !== "string") return text;
  const value = text.trim();

  if (typeof highlight === "number") {
    const parts = value.split(/\s+/);
    if (parts.length <= highlight) return text;
    return (
      <>
        {parts.slice(0, -highlight).join(" ")} <HighlightText>{parts.slice(-highlight).join(" ")}</HighlightText>
      </>
    );
  }

  const at = value.toLowerCase().indexOf(String(highlight).toLowerCase());
  if (at < 0 || String(highlight).length >= value.length) return text;
  /* Punctuation that follows the phrase goes INSIDE the block: the block
     is an inline-block, and a full stop left outside it can wrap onto a
     line of its own. */
  let end = at + String(highlight).length;
  while (end < value.length && /[.,!?;:’']/.test(value[end])) end += 1;
  return (
    <>
      {value.slice(0, at)}
      <HighlightText>{value.slice(at, end)}</HighlightText>
      {value.slice(end)}
    </>
  );
}

/* The old name, for `highlightLast(text, n)` callers. */
export const highlightLast = (text, words = 1) => withHighlight(text, words);
