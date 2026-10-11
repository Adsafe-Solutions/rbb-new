/* Milestone 6: a project's location, stage, date, impact figures, partners
   and story, as the editor handles them. The contract (packages/
   content-schema projects/project.ts) is the rule; these mirror it so a
   problem shows beside the item before saving, and the API checks it again.
   An emptied list is cleared (content/storyFields listOrNone). */

export interface ImpactFigure {
  value: string;
  label: string;
}

export const LOCATION_MAX = 120;
export const STAGE_MAX = 60;
export const IMPACT_FIGURES_MAX = 8;
export const FIGURE_VALUE_MAX = 40;
export const FIGURE_LABEL_MAX = 160;
export const PARTNERS_MAX = 12;
export const PARTNER_MAX = 160;

/* What would be refused, per figure (by index) and per field. A figure is
   told apart by "value — label", as the page shows it. */
export function figureProblems(figures: readonly ImpactFigure[]): Map<number, { value?: string; label?: string }> {
  const problems = new Map<number, { value?: string; label?: string }>();
  const seen = new Set<string>();
  figures.forEach((f, i) => {
    const found: { value?: string; label?: string } = {};
    if (!f.value.trim()) found.value = "Add the figure.";
    if (!f.label.trim()) found.label = "Say what it counts.";
    const shown = `${f.value} — ${f.label}`.trim();
    if (!found.value && !found.label && seen.has(shown)) found.value = "The same figure as an earlier one.";
    seen.add(shown);
    if (found.value || found.label) problems.set(i, found);
  });
  return problems;
}

/* What would be refused, per partner (by index). */
export function partnerProblems(names: readonly string[]): Map<number, string> {
  const problems = new Map<number, string>();
  const seen = new Set<string>();
  names.forEach((name, i) => {
    const words = name.trim();
    if (!words) problems.set(i, "Name the partner, or remove the line.");
    else if (seen.has(words)) problems.set(i, "The same partner as an earlier line.");
    seen.add(words);
  });
  return problems;
}
