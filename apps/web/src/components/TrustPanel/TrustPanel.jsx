import { useId } from "react";
import { Link } from "react-router-dom";
import Button from "../Button/Button.jsx";
import LineIcon from "../LineIcon/LineIcon.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import TicketCard from "../TicketCard/TicketCard.jsx";

/* The trust layer: the statement on Deep Trust Blue, and beside it the
   documents a donor would check, as a ticket — the kind of thing you
   could be handed and keep.

   Deliberately short. The detail lives in the Transparency section of /about; this has
   to prove the path exists and name what will be there.

   `links` are { title, to } for a page on the site, or { title, href }
   for a file (a report PDF). A link's own `meta` is the line under it;
   `linkMeta` is the fallback — until RBB supplies the documents it says
   they are to come, and each row still goes to the Transparency page,
   never to a file that does not exist. No figure, registration or audit
   claim is made here. */
const ICONS = ["document", "chart", "shield"];

export default function TrustPanel({ id, index, kicker, heading, body, links, linkMeta, cta, tone = "ink", highlight }) {
  const headingId = useId();

  return (
    <Section id={id} tone={tone} pad="lg" watermark="left" aria-labelledby={headingId}>
      <div className="grid items-center gap-14 lg:grid-cols-[6fr_5fr] lg:gap-20">
        <div>
          <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} intro={body} highlight={highlight} size="billboard" />
          {cta && (
            <Button data-anim="soft" variant="solid" to={cta.to} className="mt-9">
              {cta.label}
            </Button>
          )}
        </div>

        <div className="reveal lg:pl-6">
          <TicketCard
            kicker={kicker}
            rows={links.map((link, i) => {
              const Row = link.href ? "a" : Link;
              const target = link.href ? { href: link.href } : { to: link.to };
              const meta = link.meta ?? linkMeta;
              return (
                <Row {...target} className="group flex items-center gap-4 rounded-lg">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pop text-on-pop">
                    <LineIcon name={ICONS[i % ICONS.length]} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[19px] font-extrabold leading-tight text-fg underline-offset-4 group-hover:underline">
                      {link.title}
                    </span>{" "}
                    {meta && <span className="type-note mt-1 block font-medium text-quiet">{meta}</span>}
                  </span>
                  <LineIcon name="arrow" className="h-5 w-5 text-fg transition-transform group-hover:translate-x-1" />
                </Row>
              );
            })}
          />
        </div>
      </div>
    </Section>
  );
}
