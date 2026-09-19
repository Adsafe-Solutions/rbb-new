import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";

/* The donation form beside a photograph.

   No payment happens here. The form only settles WHAT the gift is —
   frequency, amount, the optional add-on — and hands that to the donate
   page as query params. Card details belong to whatever checkout sits
   behind that route, never to a marketing section.

   A selected amount is marked by a Sky Blue border and Sky Blue text, not
   a Sky Blue fill — the fill reads badly as a small saturated rectangle,
   the outline reads as a clear "this one" without it. The frequency
   toggle is the header's nav-pill pattern (white pill on a soft ground) so
   the two controls read as one family. */

const FREQUENCIES = [
  { key: "once", label: "Give once" },
  { key: "monthly", label: "Regular giving" },
];

export default function DonateWidget({ appeal, amounts, currency, addon, cta, src, alt }) {
  const navigate = useNavigate();
  const [frequency, setFrequency] = useState("once");
  const [preset, setPreset] = useState(null);
  const [custom, setCustom] = useState("");
  const [addonOn, setAddonOn] = useState(false);

  const amount = custom !== "" ? Number(custom) : preset;
  const ready = Number.isFinite(amount) && amount > 0;

  const submit = () => {
    const params = new URLSearchParams({ amount, frequency, addon: addonOn ? "1" : "0" });
    navigate(`${cta.to}?${params}`);
  };

  return (
    <section className="py-20 md:py-32">
      <Container>
        <div className="reveal grid items-center gap-12 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-20">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (ready) submit();
            }}
            className="rounded-3xl bg-paper-white p-8 shadow-sm"
          >
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-bold text-[length:var(--text-subheading)] leading-subheading tracking-subheading">
                {appeal.name}
              </p>
              <Link
                to={appeal.changeTo}
                className="text-[length:var(--text-caption)] tracking-caption text-graphite hover:underline"
              >
                Change
              </Link>
            </div>

            <div
              role="radiogroup"
              aria-label="How often"
              className="mt-6 grid grid-cols-2 gap-1 rounded-2xl bg-mist p-1"
            >
              {FREQUENCIES.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="radio"
                  aria-checked={frequency === f.key}
                  onClick={() => setFrequency(f.key)}
                  className={cx(
                    "rounded-2xl py-2.5 font-medium transition-colors",
                    frequency === f.key
                      ? "bg-paper-white text-bumble-ink shadow-sm"
                      : "text-graphite hover:text-bumble-ink"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div role="radiogroup" aria-label="Amount" className="mt-4 grid grid-cols-3 gap-2">
              {amounts.map((value) => {
                const selected = custom === "" && preset === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setPreset(value);
                      setCustom("");
                    }}
                    className={cx(
                      "rounded-2xl border py-3 font-semibold transition-colors",
                      selected
                        ? "border-bumble-honey bg-mist text-bumble-honey"
                        : "border-mist hover:border-charcoal"
                    )}
                  >
                    {currency.symbol}
                    {value}
                  </button>
                );
              })}
            </div>

            <label className="mt-4 flex items-center gap-2 rounded-2xl border border-mist px-4 py-3 focus-within:border-bumble-ink">
              <span className="text-graphite">{currency.symbol}</span>
              <span className="sr-only">Other amount</span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                placeholder="0"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="w-full bg-transparent font-bold text-[length:var(--text-subheading)] outline-none placeholder:text-graphite/60"
              />
              <span className="text-[length:var(--text-caption)] tracking-caption text-graphite">
                {currency.code}
              </span>
            </label>

            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-mist px-4 py-3">
              <button
                type="button"
                role="switch"
                aria-checked={addonOn}
                aria-label={addon}
                onClick={() => setAddonOn((v) => !v)}
                className={cx(
                  "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                  /* The site-wide focus ring assumes a 9px corner; on a pill
                     that draws a box around a capsule. Match the track. */
                  "focus-visible:rounded-full focus-visible:outline-offset-2",
                  addonOn ? "bg-growth-green" : "bg-charcoal/30"
                )}
              >
                <span
                  className={cx(
                    "absolute left-0 top-1 h-5 w-5 rounded-full bg-paper-white shadow-sm",
                    "transition-transform duration-200",
                    addonOn ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
              <span className="text-[length:var(--text-caption)] tracking-caption">{addon}</span>
            </div>

            <Button
              type="submit"
              disabled={!ready}
              className="mt-6 w-full disabled:cursor-not-allowed disabled:bg-mist disabled:text-graphite"
            >
              {cta.label}
            </Button>
          </form>

          <div className="aspect-[4/3] overflow-hidden rounded-3xl rounded-tl-[5rem] lg:aspect-[3/2]">
            <img
              src={src}
              alt={alt}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
