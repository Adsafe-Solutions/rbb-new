/* The colour of each band on a page assembled from CMS blocks
   (pages/Home/CmsHome, pages/About/CmsAbout). Each block type lists the
   tones it can take, its source page's own first: a band keeps that tone
   unless the band before it ended on the same ground — then it takes its
   next choice, so no two neighbours share a ground in any order. A block
   whose component draws its own bands ({ start, end }, e.g. the About
   page's transparency chapter: Deep Trust Blue, then white) is fixed. The
   last band never takes Deep Trust Blue, which would merge into the
   footer. */
export function resolveTones(types, choices) {
  const tones = [];
  let previousEnd;
  types.forEach((type, i) => {
    const options = choices[type];
    if (!options) throw new Error(`No tone rule for a "${type}" block`);
    const last = i === types.length - 1;
    if (!Array.isArray(options)) {
      tones.push(options.start);
      previousEnd = options.end;
      return;
    }
    const tone = options.find((t) => t !== previousEnd && !(last && t === "ink")) ?? options[0];
    tones.push(tone);
    previousEnd = tone;
  });
  return tones;
}
