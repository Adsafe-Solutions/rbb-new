import { useCallback, useEffect, useState } from "react";
import { FormField, Input, Spinner } from "../design-system";
import { RecordPicker, type PickableRecord } from "../blocks/fields";
import { metricsApi } from "../content/client";

/* The figures a `stats` block names (the homepage's, the Impact page's),
   by key, from the CMS's impact figures — never restated, so both pages
   show the same values. Up to six, in the order chosen.

   Until the organization manages figures here, the website's own figures
   are named by their keys (lives, countries, partners), typed as before;
   once a figure is published here, the website publish checks that every
   named figure is a published one. */

export function MetricsField({ value, onChange, error, disabled }: { value: string[]; onChange: (keys: string[]) => void; error?: string; disabled: boolean }) {
  const [figures, setFigures] = useState<PickableRecord[] | null>(null);
  useEffect(() => {
    let live = true;
    metricsApi
      .list({ pageSize: 100, sort: "updated" })
      .then(({ items }) =>
        items
          .filter((v) => v.record.status !== "archived")
          .sort((a, b) => a.record.order - b.record.order)
          .map((v) => ({ id: v.record.slug, title: `${v.record.value} — ${v.record.label}`, status: v.record.status, live: v.live, detail: `Key: ${v.record.slug} · ${v.record.verification === "verified" ? "verified" : "awaiting verification"}` }))
      )
      .then((list) => live && setFigures(list), () => live && setFigures([]));
    return () => {
      live = false;
    };
  }, []);
  const load = useCallback(() => Promise.resolve(figures ?? []), [figures]);

  if (!figures) return <Spinner label="Loading the impact figures" />;
  if (figures.length === 0)
    return (
      <FormField label="Figures" required helper="No impact figures are managed here yet, so this names the website's own figures by key, in order, separated by commas (lives, countries, partners). Once figures are added under Impact figures, choose them here." error={error} disabled={disabled}>
        <Input value={value.join(", ")} onChange={(e) => onChange(e.target.value.split(/[\s,]+/).filter(Boolean))} />
      </FormField>
    );
  return <RecordPicker label="Figures" load={load} value={value} onChange={onChange} max={6} disabled={disabled} error={error} />;
}
