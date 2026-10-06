import { BRAND } from "../../content/index.js";
import Mark from "../Mark/Mark.jsx";

/* The word whose "O" becomes the RBB mark — RBB's call (Oct 2026): the
   mark at the centre of the name, in Sky Blue, the band's one accent. */
const MARK_WORD = "Beyond";

/* A word as type, with its first "o" swapped for the mark when it is
   MARK_WORD. The mark sits on the baseline at about the letter O's
   height (0.74em, a touch over cap height, as an O's overshoot is), with
   a hair of side space so the tight tracking does not crowd it. */
function Word({ word }) {
  const at = word === MARK_WORD ? word.toLowerCase().indexOf("o") : -1;
  if (at < 0) return word;
  return (
    <>
      {word.slice(0, at)}
      <Mark className="mx-[0.03em] inline-block h-[0.74em] w-[0.74em] align-baseline text-bumble-honey" />
      {word.slice(at + 1)}
    </>
  );
}

/* The footer's signature: the organisation's full name, set as the
   largest type on the site — the last thing a page says.

   Sized against the FOOTER's own width (container query units, `cqw`),
   not the window's, so it fills the column edge to edge at every width
   without measuring anything in JavaScript:
     · below `md` the three words stack, one per line, at 23.4% of the
       column — "BORDERS", the longest, fills about 97% of it
     · from `md` up the name runs on one line at 9% of the column, also
       about 97% full
   The ~3% left over absorbs rendering differences, so the line never
   overflows (measured per word at 320 → 1440px).

   The "O" of BEYOND is the RBB mark (see MARK_WORD).

   Decorative: `aria-hidden`. The name is already in the footer as text
   (the copyright line) and in the header logo, so a screen reader does
   not hear it a third time. The words are live type in the brand face —
   it follows content/brand.js, no artwork to keep in step. */
export default function FooterWordmark({ className = "" }) {
  const words = BRAND.fullName.split(" ");

  return (
    <div aria-hidden="true" className={`@container select-none ${className}`}>
      <p className="font-black uppercase leading-[0.84] tracking-[-0.045em] text-fg text-[23.4cqw] md:whitespace-nowrap md:text-[9cqw]">
        {words.map((word, i) => (
          <span key={word} className="block md:inline">
            <Word word={word} />
            {i < words.length - 1 && <span className="hidden md:inline"> </span>}
          </span>
        ))}
      </p>
    </div>
  );
}
