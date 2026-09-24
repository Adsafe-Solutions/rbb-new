import { useId } from "react";
import { Link } from "react-router-dom";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";
import LineIcon from "../LineIcon/LineIcon.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";

/* The trust layer: one quiet Light Gray panel — the statement on the
   left, the documents a donor would check on the right, one route to the
   full Transparency page. Deliberately small. The detail lives on
   /about/transparency; this only has to prove the path exists.

   `links` are { title, to } for a page on the site, or { title, href } for
   a file (a report PDF) — the one a plain <a>, the other a router link.
   A link's own `meta` is the line under it; `linkMeta` is the fallback.
   Until RBB supplies the documents that line says they are to come, and
   each row still goes to the Transparency page, never to a file that does
   not exist. Icons cycle in a fixed order so each row reads as a different
   kind of thing. */
const ICONS = ["document", "chart", "shield"];

export default function TrustPanel({ id, kicker, heading, body, links, linkMeta, cta }) {
  const headingId = useId();

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-[var(--header-h)] py-20 md:py-28"
    >
      <Container>
        <div className="reveal grid gap-10 rounded-3xl rounded-tr-[5rem] bg-mist p-5 sm:p-10 md:p-14 lg:grid-cols-[5fr_6fr] lg:items-center lg:gap-16">
          <div>
            <SectionHeading
              id={headingId}
              kicker={kicker}
              heading={heading}
              intro={body}
            />
            {cta && (
              <Button variant="outline" to={cta.to} className="mt-8">
                {cta.label}
              </Button>
            )}
          </div>

          <ul className="flex flex-col gap-stack">
            {links.map((link, i) => {
              const Row = link.href ? "a" : Link;
              const target = link.href ? { href: link.href } : { to: link.to };
              const meta = link.meta ?? linkMeta;
              return (
                <li key={link.title}>
                  <Row
                    {...target}
                    className="group flex items-center gap-4 rounded-2xl bg-paper-white p-4 transition-colors sm:gap-5 sm:p-5 hover:bg-paper-white/70"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bumble-honey/12 text-trust-blue sm:h-12 sm:w-12">
                      <LineIcon name={ICONS[i % ICONS.length]} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-trust-blue underline-offset-4 group-hover:underline">
                        {link.title}
                      </span>{" "}
                      {meta && (
                        <span className="mt-0.5 block text-[length:var(--text-caption)] leading-caption tracking-caption text-graphite">
                          {meta}
                        </span>
                      )}
                    </span>
                    <LineIcon
                      name="arrow"
                      className="h-5 w-5 text-trust-blue transition-transform group-hover:translate-x-1"
                    />
                  </Row>
                </li>
              );
            })}
          </ul>
        </div>
      </Container>
    </section>
  );
}
