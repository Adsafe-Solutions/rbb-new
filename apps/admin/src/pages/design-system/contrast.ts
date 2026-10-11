/* WCAG 2 contrast between two CSS colours, read from the live tokens.
   The browser resolves any colour syntax (hex, color-mix(), color()) to
   pixels by painting it on a 1×1 canvas, so the check sees exactly what
   the page renders. Translucent colours are composited over white. */

const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
const context = canvas?.getContext("2d", { willReadFrequently: true }) ?? null;

export function resolveColor(css: string): [number, number, number] | null {
  if (!context) return null;
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 1, 1);
  context.fillStyle = css;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The computed value of a custom property, resolved to a colour. */
export function tokenColor(token: string, element: Element = document.documentElement): [number, number, number] | null {
  const probe = document.createElement("span");
  probe.style.color = `var(${token})`;
  element.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return resolveColor(value);
}

export const toHex = ([r, g, b]: [number, number, number]) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
