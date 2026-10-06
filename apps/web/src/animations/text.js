/* =========================================================
   Headline reveals — SplitText, by the LINE.

   Lines, never characters. A headline whose letters arrive one at a
   time is a portfolio effect: it draws attention to the animation
   instead of to the sentence, and on a three-line hero it is ninety
   separate elements to lay out and animate. Lines read as editorial —
   the way a headline is set on a page — and are three elements.

   Each line is wrapped in a clipping mask (`mask: "lines"`), so the
   line rises out of nothing rather than fading in place. That mask is
   the whole reason this is worth a plugin: it is the difference
   between "premium" and "a fade".

   ACCESSIBILITY. SplitText breaks one text node into one element per
   line, which a screen reader would otherwise read as separate
   fragments. `aria: "auto"` puts the original string back as the
   element's accessible name, so the headline is announced as the one
   sentence it is. Nothing here is ever the only copy of the text: the
   pre-rendered HTML holds it, and without JavaScript no split happens
   at all.

   RE-SPLITTING. A line break depends on the width of the box and on
   which font has loaded — both of which change after the split. GSAP's
   `autoSplit` re-splits on either, which is the only way the masks
   stay on the actual lines. ⚠ Which is also why the animation is
   created INSIDE `onSplit`: it has to be rebuilt against the new line
   elements, and the old one thrown away with the old lines.
========================================================= */
import { gsap, SplitText } from "./gsap.js";
import { DURATION, EASE, ONCE, START, STAGGER } from "./config.js";

/* Reveals `el`'s lines upward out of their masks.

   `trigger`/`start` hand it to the scroll; leave them off and it plays
   on mount, which is what the hero wants. Returns the SplitText so the
   caller can revert it — see the warning below.

   ⚠ A split leaves real markup in the DOM. It MUST be reverted when
   the page unmounts, or a route change leaves a headline made of
   orphaned line divs behind and React has lost track of its own
   children. animations/reveals.js owns that. */
export function revealLines(el, { trigger, delay = 0 } = {}) {
  /* The element itself is hidden by CSS until something claims it
     (styles/index.css). The LINES are what animates from here, so the
     element goes visible now and the masks do the hiding. */
  gsap.set(el, { opacity: 1 });

  /* An entrance plays once. After that a re-split — the reader turned
     their phone, or a font finally arrived — must put the new lines
     straight into their finished state, not run the entrance again
     under someone who is halfway down the page. */
  let played = false;

  return SplitText.create(el, {
    type: "lines",
    mask: "lines",
    autoSplit: true,
    aria: "auto",
    onSplit(self) {
      if (played) {
        gsap.set(self.lines, { yPercent: 0 });
        return undefined;
      }
      return gsap.from(self.lines, {
        /* Past 100% so the line clears its mask completely before it
           starts moving — at exactly 100 the top edge of a descender
           can still be showing. */
        yPercent: 115,
        duration: DURATION.headline,
        ease: EASE.out,
        stagger: STAGGER.lines,
        delay,
        onComplete: () => {
          played = true;
        },
        scrollTrigger: trigger ? { trigger, start: START, once: ONCE } : undefined,
      });
    },
  });
}
