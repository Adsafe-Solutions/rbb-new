import { cx } from "../../lib/cx.js";
import Container from "../Container/Container.jsx";

/* The impact mosaic: a Light Gray band carrying three columns of mixed
   stat cards and photographs, with the headline figure set over the tall
   middle photograph.

   White cards on the Light Gray band get no shadow — the shadow is for
   white lifting off white, and the tone difference already does the work.
   Each stat carries a short Sky Blue rule beside its label — a border, not
   a fill, so the accent colour stays a hairline rather than a wash. */

function StatCard({ value, label }) {
  return (
    <div className="rounded-3xl bg-paper-white p-8 md:p-10">
      <p className="font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
        {value}
      </p>
      <p className="mt-6 border-l-4 border-bumble-honey pl-3 text-[length:var(--text-caption)] font-semibold tracking-caption">
        {label}
      </p>
    </div>
  );
}

function Picture({ src, alt, ratio, className = "" }) {
  return (
    <div className={cx("overflow-hidden rounded-3xl", className)} style={{ aspectRatio: ratio }}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </div>
  );
}

export default function ImpactMosaic({ leadStat, leadPhoto, feature, sidePhoto, sideStat }) {
  return (
    <section className="bg-mist py-20 md:py-32">
      <Container>
        <div className="reveal grid gap-cards md:grid-cols-3">
          <div className="flex flex-col gap-cards">
            <StatCard {...leadStat} />
            <Picture {...leadPhoto} ratio="1/1" />
          </div>

          <div className="relative overflow-hidden rounded-3xl" style={{ aspectRatio: "3/4" }}>
            <img
              src={feature.src}
              alt={feature.alt}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
            {/* Type over a photograph sits on a gradient, never a flat
                scrim — the design never puts a hard edge inside a photo. */}
            <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-bumble-ink/70 to-transparent p-6 pb-24 text-paper-white md:p-8">
              <p className="border-l-4 border-bumble-honey pl-3 text-[length:var(--text-caption)] font-medium tracking-caption">
                {feature.label}
              </p>
              <p className="mt-4 font-bold text-[length:var(--text-display)] leading-display tracking-display">
                {feature.value}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-cards">
            <Picture {...sidePhoto} ratio="4/3" />
            <StatCard {...sideStat} />
          </div>
        </div>
      </Container>
    </section>
  );
}
