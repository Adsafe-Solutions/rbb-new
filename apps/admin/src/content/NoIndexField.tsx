import { Checkbox } from "../design-system";

/* Milestone 3: take one page out of search engines. It only ever REMOVES
   a page from the index: whether a page is indexed at all still follows
   the organization's approvals and the absence of sample content (the
   website's content/seo.js) — this cannot put a page in. */
export function NoIndexField({ value, onChange, disabled, noun = "page" }: { value: boolean | undefined; onChange: (noIndex: boolean | undefined) => void; disabled: boolean; noun?: string }) {
  return (
    <Checkbox
      label="Keep out of search engines"
      description={`Search engines are asked not to list this ${noun}, even once it is approved for search. It never adds a ${noun} to search results.`}
      checked={Boolean(value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked || undefined)}
    />
  );
}
