/* Only the newest of overlapping loads may be shown (M48). A load asks
   `begin()` for its ticket and applies its reply only while the ticket is
   still current: a later load, or a save or workflow step that has
   already shown a newer revision (`supersede()`), retires it. React's
   development double effects, a quick reload and a slow network all
   answer out of order, and an earlier reply must never overwrite what has
   been shown — or typed — since. The pattern PopupPage, HighlightsPage and
   UsersPage use, as a helper the content editor can share. */
export function latestLoads() {
  let current = 0;
  return {
    begin(): () => boolean {
      const ticket = ++current;
      return () => ticket === current;
    },
    supersede() {
      current++;
    },
  };
}
