import { useId } from "react";
import { cx } from "../../lib/cx.js";
import EmptyPanel from "../EmptyPanel/EmptyPanel.jsx";
import MarkStamp from "../Mark/MarkStamp.jsx";
import OffsetCard from "../OffsetCard/OffsetCard.jsx";
import Section from "../Section/Section.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import { ORG_CONTACT, methodHref, officeLines, verifiedOnly } from "../../content/index.js";

/* The ways to reach RBB, as a row of channel cards — the mark stamped on
   each, the channel's name in small capitals, the address or number
   itself in display weight — ONLY for channels content/contact.js marks
   verified. Each card is a <dt> label and a <dd> value, and every link's
   text is the address or number itself, so its accessible name says
   exactly where it goes.

   Nothing unverified gets a card: no "Phone: —", no empty map frame. With
   no verified channel at all the section shows the pending line on a
   pinned-up sheet, so an unavailable method is never given the
   prominence of a real one (Document 08). `labels` names each kind. */
export default function ContactMethods({ index, kicker, heading, labels, tone = "white", highlight }) {
  const headingId = useId();
  const { hours, responseTime, office } = ORG_CONTACT;
  const address = officeLines();

  const tiles = [
    ...verifiedOnly(ORG_CONTACT.methods).map((method) => ({
      key: method.id,
      label: method.label ?? labels[method.type] ?? method.type,
      value: method.value,
      href: methodHref(method),
      note: method.description,
    })),
    address && { key: "office", label: labels.office, lines: address, href: office.mapUrl, linkLabel: labels.map },
    hours.status === "verified" && hours.value && { key: "hours", label: labels.hours, value: hours.value },
    responseTime.status === "verified" &&
      responseTime.value && { key: "response", label: labels.response, value: responseTime.value },
  ].filter(Boolean);

  const socials = verifiedOnly(ORG_CONTACT.social);
  /* Nothing verified and no line to say instead: the section is left out
     rather than announcing what is missing. */
  if (tiles.length === 0 && socials.length === 0 && !ORG_CONTACT.pending) return null;
  const LINK = "font-extrabold text-fg underline decoration-bumble-honey decoration-[3px] underline-offset-4 hover:decoration-trust-blue";

  return (
    <Section tone={tone} pad="lg" aria-labelledby={headingId}>
      <SectionHeading id={headingId} index={index} kicker={kicker} heading={heading} highlight={highlight} />

      {tiles.length === 0 && socials.length === 0 ? (
        <EmptyPanel text={ORG_CONTACT.pending} className="reveal mt-12" />
      ) : (
        <dl data-anim-stagger className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Valid list structure: each card IS the one <div> grouping
              its <dt>/<dd> directly inside the <dl>, and the decorative
              stamp sits inside the <dt> (a <dl> group may hold nothing
              else). The cards have no tilt, so they can be the stagger's
              reveal targets themselves. */}
          {tiles.map((tile) => (
              <OffsetCard key={tile.key} className="h-full">
                <dt className="text-quiet">
                  <MarkStamp className="h-9 w-9" />
                  <span className="type-meta mt-6 block">{tile.label}</span>
                </dt>
                <dd className="mt-2 text-[21px] leading-snug text-copy">
                  {tile.lines ? (
                    <address className="not-italic">
                      {tile.lines.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                      {tile.href && (
                        <a href={tile.href} target="_blank" rel="noopener noreferrer" className={cx("mt-3 inline-block text-[16px]", LINK)}>
                          {tile.linkLabel}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      )}
                    </address>
                  ) : tile.href ? (
                    <a href={tile.href} className={cx("break-words", LINK)}>
                      {tile.value}
                    </a>
                  ) : (
                    tile.value
                  )}
                  {tile.note && <span className="mt-2 block text-[15px] text-quiet">{tile.note}</span>}
                </dd>
              </OffsetCard>
          ))}
          {socials.length > 0 && (
              <OffsetCard className="h-full">
                <dt className="text-quiet">
                  <MarkStamp className="h-9 w-9" />
                  <span className="type-meta mt-6 block">{labels.social}</span>
                </dt>
                <dd className="mt-3">
                  <ul className="flex flex-wrap gap-x-5 gap-y-2">
                    {socials.map((s) => (
                      <li key={s.platform}>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className={LINK}>
                          {s.label}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </dd>
              </OffsetCard>
          )}
        </dl>
      )}
    </Section>
  );
}
