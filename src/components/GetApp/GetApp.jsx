import { cx } from "../../lib/cx.js";
import PhoneMock from "../PhoneMock/PhoneMock.jsx";
import Container from "../Container/Container.jsx";
/* Catalogue-only sample data (/components), imported directly rather than
   through content/index.js so it never enters the public build. */
import { GET_APP } from "../../content/home.js";

/* The download band that closes the page.

   A Light Gray card rather than a full-bleed band: the page opens with
   bleed and closes contained, so the footer underneath reads as a
   separate surface instead of a continuation of the section above.

   ⚠ The QR code is drawn from a fixed pattern, not generated — it is a
   placeholder shape at the right density so the block holds its layout. It
   does not scan. Swap in a real code (an <img>, or a generator keyed to the
   store link) before this ships anywhere public. */

/* A deterministic dark/light grid: dense enough to read as a QR code from
   across a page, with the three corner finder squares drawn properly, which
   is what the eye actually recognises. */
function QrPlaceholder({ className = "" }) {
  const size = 21;
  const isFinder = (r, c) =>
    (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);

  const cells = [];
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (isFinder(r, c)) continue;
      /* A cheap hash of the coordinates — stable between renders, so the
         code does not shimmer when React re-renders the section. */
      if ((r * 7 + c * 13 + ((r * c) % 5)) % 3 === 0) {
        cells.push(<rect key={`${r}-${c}`} x={c} y={r} width="1" height="1" />);
      }
    }
  }

  const finder = (x, y) => (
    <g key={`f-${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="var(--color-paper-white)" />
      <rect x={x + 2} y={y + 2} width="3" height="3" />
    </g>
  );

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="QR code to download the app"
      fill="var(--color-bumble-ink)"
      shapeRendering="crispEdges"
      className={cx("bg-paper-white", className)}
    >
      {cells}
      {finder(0, 0)}
      {finder(size - 7, 0)}
      {finder(0, size - 7)}
    </svg>
  );
}

export default function GetApp() {
  return (
    <section className="pb-16 md:pb-24">
      <Container>
        <div
          className={cx(
            "reveal relative grid items-end gap-8 overflow-hidden rounded-3xl",
            "bg-mist p-8 md:grid-cols-2 md:p-12"
          )}
        >
          <div className="pb-4 md:pb-12">
            <h2
              className={cx(
                "font-bold text-[length:var(--text-heading-lg)]",
                "leading-heading-lg tracking-heading-lg",
                "md:text-[length:clamp(3.5rem,5vw,4.5rem)]"
              )}
            >
              {GET_APP.heading}
            </h2>

            <p className="mt-4">{GET_APP.body}</p>

            <QrPlaceholder className="mt-8 h-40 w-40 rounded-lg p-2" />
          </div>

          {/* Three phones, fanned. The outer two are pushed down and
              rotated away from the middle one, and the group is cropped by
              the card's bottom edge — the design lets product shots run
              out of their container rather than float inside it. */}
          <div
            aria-hidden="true"
            className="relative flex h-64 items-end justify-center gap-2 md:h-80"
          >
            <PhoneMock
              label="app-list"
              className="w-24 -rotate-6 translate-y-10 md:w-28"
            />
            <PhoneMock label={GET_APP.photo} className="w-32 md:w-40" />
            <PhoneMock
              label="app-chat"
              className="w-24 rotate-6 translate-y-10 md:w-28"
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
