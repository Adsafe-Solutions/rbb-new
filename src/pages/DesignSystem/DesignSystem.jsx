import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Badge from "../../components/Badge/Badge.jsx";
import Button from "../../components/Button/Button.jsx";
import Container from "../../components/Container/Container.jsx";

/* The living token reference at /design-system.

   Not documentation ABOUT the system — the system itself, rendered. Every
   swatch below is a real utility from theme.css, so a token that changes
   changes here, and a swatch that looks wrong means the token is wrong.
   That is the whole value: a written spec drifts from the code, this
   cannot.

   Off in production builds by default (see config/sections.js). */

/* ⚠ EVERY CLASS HERE IS WRITTEN OUT IN FULL, never assembled as
   `bg-${token}`. Tailwind finds classes by scanning source files for
   literal strings — it does not evaluate JavaScript — so an interpolated
   name matches nothing, the utility is never generated, and the swatch
   renders transparent. The duplication between `token` and `swatch` is
   the price of the scanner seeing them. */
const COLORS = [
  {
    name: "Bright Sky Blue",
    token: "bg-bumble-honey",
    swatch: "bg-bumble-honey",
    use: "Bands, frames, highlights, icons, accents",
  },
  {
    name: "Deep Trust Blue",
    token: "bg-trust-blue",
    swatch: "bg-trust-blue",
    use: "Headlines, wordmark, navigation, links",
  },
  {
    name: "Growth Green",
    token: "bg-growth-green",
    swatch: "bg-growth-green",
    use: "The filled call-to-action button, success states",
  },
  {
    name: "Charcoal",
    token: "bg-bumble-ink",
    swatch: "bg-bumble-ink",
    use: "Body text, icons, borders, the dark card",
  },
  {
    name: "Light Gray",
    token: "bg-mist",
    swatch: "bg-mist border border-graphite/20",
    use: "Cards, sections, quiet surfaces (also bg-pollen)",
  },
  {
    name: "White",
    token: "bg-paper-white",
    swatch: "bg-paper-white border border-mist",
    use: "Page canvas, card surface, inverse text",
  },
  {
    name: "Graphite",
    token: "bg-graphite",
    swatch: "bg-graphite",
    use: "Helper text, low-emphasis labels",
  },
];

/* Written out in full for the same reason as COLORS above. */
const TYPE = [
  {
    name: "display",
    cls: "text-display leading-display tracking-display",
    sample: "Meet people",
  },
  {
    name: "heading-lg",
    cls: "text-heading-lg leading-heading-lg tracking-heading-lg",
    sample: "Bring people closer",
  },
  {
    name: "heading",
    cls: "text-heading leading-heading tracking-heading",
    sample: "Share your ideas",
  },
  {
    name: "heading-sm",
    cls: "text-heading-sm leading-heading-sm tracking-heading-sm",
    sample: "Find your person",
  },
  {
    name: "subheading",
    cls: "text-subheading leading-subheading tracking-subheading",
    sample: "A short supporting line",
  },
  {
    name: "body",
    cls: "text-body leading-body tracking-body",
    sample: "Body copy runs at 17px with open tracking.",
  },
  {
    name: "caption",
    cls: "text-caption leading-caption tracking-caption",
    sample: "Caption and badge text at 15px.",
  },
];

const SPACING = [
  ["8px", "p-2"],
  ["12px", "p-3"],
  ["16px", "p-4"],
  ["20px", "p-5"],
  ["24px", "p-6"],
  ["32px", "p-8"],
  ["36px", "p-9"],
  ["40px", "p-10"],
  ["48px", "p-12"],
];

const RADII = [
  { name: "small elements", value: "9px", cls: "rounded-lg" },
  { name: "buttons / nav / photos", value: "16px", cls: "rounded-2xl" },
  { name: "cards", value: "24px", cls: "rounded-3xl" },
  { name: "badges", value: "1000px", cls: "rounded-full" },
];

function Section({ title, note, children }) {
  return (
    <section className="py-12">
      <h2 className="font-bold text-[length:var(--text-heading)] leading-heading tracking-heading">
        {title}
      </h2>
      {note && <p className="mt-3 max-w-prose text-graphite">{note}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function DesignSystem() {
  return (
    <Container className="py-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h1 className="font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
          Design system
        </h1>
        <Link
          to="/components"
          className="text-[length:var(--text-caption)] tracking-caption text-graphite hover:underline"
        >
          Components →
        </Link>
      </div>
      <p className="mt-4 max-w-prose text-graphite">
        Every value below is rendered from a live utility in{" "}
        <code>src/styles/theme.css</code>. If a swatch looks wrong, the token is wrong —
        there is no second copy to check against.
      </p>

      <Section
        title="Colour"
        note="Two blues, one green, three neutrals. The blues carry trust and the green is reserved for the call to action; token names are historical, read the swatch names for the role."
      >
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {COLORS.map((color) => (
            <li key={color.token}>
              {/* The two lightest swatches carry a hairline — paper on
                  paper is otherwise invisible. It is part of `swatch`. */}
              <div className={cx("h-24 rounded-2xl", color.swatch)} />
              <p className="mt-3 font-medium">{color.name}</p>
              <p className="text-[length:var(--text-caption)] tracking-caption text-graphite">
                {color.token}
              </p>
              <p className="mt-1 text-[length:var(--text-caption)] tracking-caption text-graphite">
                {color.use}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Typography"
        note="Each size ships with its own leading and tracking — pair them. The positive tracking at every size is what gives the face its open cadence; never zero it out."
      >
        <ul className="flex flex-col gap-8">
          {TYPE.map((row) => (
            <li key={row.name} className="border-t border-mist pt-5">
              <p className="text-[length:var(--text-caption)] tracking-caption text-graphite">
                {row.cls}
              </p>
              <p className={cx("mt-2 font-bold", row.cls)}>{row.sample}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Spacing"
        note="The base unit is 4px, which is also Tailwind's native scale — the px-named tokens map onto it directly rather than replacing it."
      >
        <ul className="flex flex-wrap items-end gap-6">
          {SPACING.map(([label, cls]) => (
            <li key={cls}>
              <div className={cx("inline-block bg-trust-blue", cls)}>
                <div className="h-2 w-2 bg-bumble-ink" />
              </div>
              <p className="mt-2 text-[length:var(--text-caption)] tracking-caption text-graphite">
                {label} · {cls}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Radius and elevation"
        note="Nothing in this system has a sharp corner. One shadow only, a whisper at 12% — never stacked, never tinted."
      >
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {RADII.map((r) => (
            <li key={r.cls}>
              <div className={cx("h-24 bg-trust-blue", r.cls)} />
              <p className="mt-3 font-medium">{r.value}</p>
              <p className="text-[length:var(--text-caption)] tracking-caption text-graphite">
                {r.cls} · {r.name}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-8 max-w-sm rounded-3xl bg-paper-white p-6 shadow-sm">
          <p className="font-medium">shadow-sm</p>
          <p className="mt-1 text-[length:var(--text-caption)] tracking-caption text-graphite">
            The one approved elevation, for white cards lifting off white.
          </p>
        </div>
      </Section>

      <Section
        title="Components"
        note="One filled button in the system, and it is ink. Yellow is the brand's warmth, not its clickability."
      >
        <div className="flex flex-wrap items-center gap-4">
          <Button>Filled action</Button>
          <Button variant="pill">Active nav pill</Button>
          <Button variant="ghost">Inactive nav link</Button>
          <Button variant="link">Underlined card link</Button>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Badge>ID verified</Badge>
          <Badge tone="honey">Outdoors</Badge>
          <Badge tone="ink">98% verified</Badge>
        </div>
      </Section>
    </Container>
  );
}
