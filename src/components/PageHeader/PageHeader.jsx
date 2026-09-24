import { Link } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import Container from "../Container/Container.jsx";

/* The opening band of an inner page that has no photograph yet: a
   breadcrumb, the page's one <h1>, and whatever intro it is given.

   The same Light Gray band PageHero uses, pulled up under the fixed
   header the same way (see Header — every offset reads `--header-h`), so
   a page can graduate from this to PageHero without its top edge moving.

   `parent` is the section the page sits in ({ label, to }). The trail is
   Home › parent › this page; a top-level page gets Home › this page.

   Optional, for pages that have more to say than a title:
     kicker  the small line above the <h1>
     crumb   the breadcrumb's name for this page, when the <h1> reads
             differently ("About Us" in the trail, "Who we are" as the h1)
     aside   a visual beside the copy from `lg`, below it on smaller
             screens */
export default function PageHeader({ title, parent, kicker, crumb, aside, children }) {
  const copy = (
    <>
      {kicker && (
        <p className="mt-8 flex items-center gap-3 text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em] text-trust-blue">
          <span aria-hidden="true" className="h-0.5 w-6 rounded-full bg-bumble-honey" />
          {kicker}
        </p>
      )}
      <h1
        className={cx(
          kicker ? "mt-4" : "mt-6",
          "font-bold text-[length:var(--text-heading)] leading-heading tracking-heading",
          "md:text-[length:var(--text-heading-lg)] md:leading-heading-lg md:tracking-heading-lg"
        )}
      >
        {title}
      </h1>

      {children}
    </>
  );

  return (
    <section className="-mt-[var(--header-h)] bg-mist pt-[var(--header-h)]">
      <Container className="py-16 md:py-24">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--text-caption)] leading-caption tracking-caption text-graphite">
            <Crumb to="/">Home</Crumb>
            {parent && <Crumb to={parent.to}>{parent.label}</Crumb>}
            <li aria-current="page" className="font-medium text-bumble-ink">
              {crumb ?? title}
            </li>
          </ol>
        </nav>

        {aside ? (
          <div className="grid items-center gap-12 lg:grid-cols-[7fr_5fr] lg:gap-16">
            <div>{copy}</div>
            {aside}
          </div>
        ) : (
          copy
        )}
      </Container>
    </section>
  );
}

function Crumb({ to, children }) {
  return (
    <li className="flex items-center gap-2">
      <Link
        to={to}
        className="underline-offset-4 transition-colors hover:text-trust-blue hover:underline"
      >
        {children}
      </Link>
      <span aria-hidden="true">/</span>
    </li>
  );
}
