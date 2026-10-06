import { cx } from "../../lib/cx.js";
import Button from "../../components/Button/Button.jsx";
import Container from "../../components/Container/Container.jsx";
import HighlightText from "../../components/HighlightText/HighlightText.jsx";
import MarkStamp from "../../components/Mark/MarkStamp.jsx";
import OffsetCard from "../../components/OffsetCard/OffsetCard.jsx";
import Section from "../../components/Section/Section.jsx";
import SectionKicker from "../../components/SectionKicker/SectionKicker.jsx";

/* The living token reference at /design-system.

   Not documentation ABOUT the system — the system itself, rendered. Every
   swatch is a real utility from theme.css and every band a real tone from
   index.css, so a token that changes changes here, and a swatch that looks
   wrong means the token is wrong.

   Off in production builds by default (see config/sections.js).

   ⚠ EVERY CLASS HERE IS WRITTEN OUT IN FULL, never assembled as
   `bg-${token}`: Tailwind finds classes by scanning for literal strings,
   so an interpolated name generates nothing and renders transparent. */
const PALETTE = [
  { name: "Deep Trust Blue", hex: "#10437C", swatch: "bg-trust-blue", role: "INK — dark bands, headings, borders, the secondary button" },
  { name: "Bright Sky Blue", hex: "#00ADEF", swatch: "bg-bumble-honey", role: "ACCENT — highlight blocks, offset shadows, the primary button, one band a page. Never text on a light surface." },
  { name: "Paper", hex: "#F5EFE6", swatch: "bg-paper border-2 border-trust-blue", role: "PAPER — the page's own ground (the `paper` tone). Pending approval." },
  { name: "White", hex: "#FFFFFF", swatch: "bg-paper-white border-2 border-trust-blue", role: "Cards, prints, clean content bands" },
  { name: "Night", hex: "#0A2647", swatch: "bg-night", role: "Contrast token: text ON Sky Blue only (5.95:1). Never a surface. Pending approval." },
  { name: "Light Gray", hex: "#F5F7FA", swatch: "bg-mist border-2 border-trust-blue", role: "Quiet UI fills — hover states, placeholders" },
  { name: "Charcoal", hex: "#3A3A3A", swatch: "bg-bumble-ink", role: "Body text on light surfaces" },
  { name: "Growth Green", hex: "#5CB85C", swatch: "bg-growth-green", role: "Success states only" },
];

const TONES = ["paper", "white", "ink", "accent"];

const TYPE = [
  { cls: "type-poster", name: "poster", sample: "Building hope." },
  { cls: "type-billboard", name: "billboard", sample: "Together we rise." },
  { cls: "type-title", name: "title", sample: "Where we focus our work" },
  { cls: "type-card", name: "card", sample: "Health & wellbeing" },
  { cls: "type-lead", name: "lead", sample: "The line under a headline: larger than body, medium weight." },
  { cls: "text-[length:var(--text-body)]", name: "body", sample: "Body text, 18px on 1.5 — comfortable for long reading." },
  { cls: "type-meta", name: "meta", sample: "01 / Kicker · label · metadata" },
];

const GAPS = [
  { cls: "gap-cards", name: "gap-cards", use: "Sibling cards in a grid, row or carousel — 16px → 24px at md" },
  { cls: "gap-tiles", name: "gap-tiles", use: "Pieces of one composition — 12px → 16px" },
  { cls: "gap-stack", name: "gap-stack", use: "Full-width cards in a vertical list — 12px" },
];

function Heading({ children, index }) {
  return (
    <div className="mb-10">
      <SectionKicker index={index}>Tokens</SectionKicker>
      <h2 className="type-title mt-4">{children}</h2>
    </div>
  );
}

export default function DesignSystem() {
  return (
    <>
      <Section tone="paper" pad="lg" className="-mt-[var(--header-h)] pt-[calc(var(--header-h)+4rem)]" watermark="right">
        <SectionKicker>Rising Beyond Borders</SectionKicker>
        <h1 className="type-billboard mt-5">
          The design <HighlightText>system</HighlightText>
        </h1>
        <p className="type-lead mt-7 max-w-[54ch] text-copy">
          Printed material, colour-blocked: ink, paper and one accent; display type as the main graphic device; hard
          offset shadows; the mark as a graphic system. Source of truth: src/styles/theme.css and index.css.
        </p>
      </Section>

      <Section tone="white" pad="lg">
        <Heading index={1}>Palette, by role</Heading>
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {PALETTE.map((c) => (
            <li key={c.name}>
              <div className={cx("h-28 rounded-2xl", c.swatch)} />
              <p className="mt-4 font-extrabold text-fg">{c.name}</p>
              <p className="type-meta mt-1 text-quiet">{c.hex}</p>
              <p className="mt-2 text-[15px] text-copy">{c.role}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="paper" pad="lg">
        <Heading index={2}>Tones — one attribute per band</Heading>
        <div className="grid gap-6 lg:grid-cols-5">
          {TONES.map((tone) => (
            <div key={tone} data-tone={tone} className="rounded-2xl border-2 border-trust-blue p-6">
              <p className="type-meta text-quiet">data-tone="{tone}"</p>
              <p className="type-card mt-3">
                A <HighlightText>headline</HighlightText>
              </p>
              <p className="mt-3 text-copy">Body text on this ground.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button size="sm">Primary</Button>
                <Button size="sm" variant="ink">
                  Ink
                </Button>
                <Button size="sm" variant="outline">
                  Outline
                </Button>
              </div>
              <OffsetCard className="mt-6" pad="sm">
                <p className="font-bold text-fg">A card on {tone}</p>
              </OffsetCard>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="white" pad="lg">
        <Heading index={3}>Type — the brand face at full weight</Heading>
        <ul className="grid gap-10">
          {TYPE.map((t) => (
            <li key={t.name} className="grid gap-3 border-t-2 border-edge pt-6 md:grid-cols-[10rem_1fr]">
              <p className="type-meta text-quiet">{t.name}</p>
              <p className={cx(t.cls, "text-fg")}>{t.sample}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="ink" pad="lg" watermark="left">
        <Heading index={4}>Hard offsets and tilt</Heading>
        <div className="grid gap-10 sm:grid-cols-3">
          <OffsetCard cast="sm" pad="md">
            <p className="type-meta">cast-sm · 3px</p>
          </OffsetCard>
          <OffsetCard cast="md" tilt="l" lift pad="md">
            <p className="type-meta">cast · 6px · tilt-l · lift</p>
          </OffsetCard>
          <OffsetCard cast="lg" tilt="r-lg" pad="md">
            <p className="type-meta">cast-lg · 10px · tilt-r-lg</p>
            <MarkStamp className="mt-6 h-14 w-14" />
          </OffsetCard>
        </div>
      </Section>

      <Section tone="paper" pad="lg">
        <Heading index={5}>Gaps between cards</Heading>
        <ul className="grid gap-10">
          {GAPS.map((g) => (
            <li key={g.name}>
              <p className="font-extrabold text-fg">{g.name}</p>
              <p className="mt-1 text-copy">{g.use}</p>
              <div className={cx("mt-4 flex", g.cls)}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-16 flex-1 rounded-xl border-2 border-trust-blue bg-paper-white" />
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Container className="py-10">
        <p className="type-meta text-quiet">Development route — not in production builds.</p>
      </Container>
    </>
  );
}
