import { useEffect, useState } from "react";

/* false during the pre-render and the first client render, true after.
   A view that depends on the query string (/stories?type=…,
   /work/projects?program=…) is pre-rendered UNFILTERED — the build has no
   query — so the browser's first render must match that HTML, and only
   then apply the query. Filtering on the first render would make React
   discard the server HTML (a hydration mismatch). */
export default function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
