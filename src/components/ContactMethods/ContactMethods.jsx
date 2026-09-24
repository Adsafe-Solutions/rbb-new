import { useId } from "react";
import Container from "../Container/Container.jsx";
import EmptyPanel from "../EmptyPanel/EmptyPanel.jsx";
import SectionHeading from "../SectionHeading/SectionHeading.jsx";
import {
  ORG_CONTACT,
  methodHref,
  officeLines,
  verifiedOnly,
} from "../../content/index.js";

/* The ways to reach RBB, as a set of labelled tiles — ONLY for channels
   content/contact.js marks verified. Each tile is a <dt> label and a <dd>
   value, and every link's text is the address or number itself, so its
   accessible name says exactly where it goes.

   Nothing unverified gets a tile: no "Phone: —", no empty map frame. With
   no verified channel at all the section shows the pending line, so an
   unavailable method is never given the prominence of a real one
   (Document 08). `labels` names each kind of tile. */
export default function ContactMethods({ kicker, heading, labels }) {
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
    address && {
      key: "office",
      label: labels.office,
      lines: address,
      href: office.mapUrl,
      linkLabel: labels.map,
    },
    hours.status === "verified" && hours.value && { key: "hours", label: labels.hours, value: hours.value },
    responseTime.status === "verified" &&
      responseTime.value && { key: "response", label: labels.response, value: responseTime.value },
  ].filter(Boolean);

  const socials = verifiedOnly(ORG_CONTACT.social);

  return (
    <section aria-labelledby={headingId} className="py-20 md:py-28">
      <Container>
        <SectionHeading id={headingId} kicker={kicker} heading={heading} className="reveal" />

        {tiles.length === 0 && socials.length === 0 ? (
          <EmptyPanel text={ORG_CONTACT.pending} className="reveal mt-10" />
        ) : (
          <dl className="reveal mt-10 grid gap-cards sm:grid-cols-2 lg:grid-cols-3">
            {tiles.map((tile) => (
              <div key={tile.key} className="rounded-3xl rounded-tr-[3rem] bg-mist p-7 md:p-8">
                <dt className="text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em] text-trust-blue">
                  {tile.label}
                </dt>
                <dd className="mt-3 text-[length:var(--text-subheading)] leading-subheading tracking-subheading text-bumble-ink">
                  {tile.lines ? (
                    <address className="not-italic">
                      {tile.lines.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                      {tile.href && (
                        <a
                          href={tile.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-block text-[length:var(--text-caption)] font-semibold text-trust-blue underline underline-offset-4"
                        >
                          {tile.linkLabel}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      )}
                    </address>
                  ) : tile.href ? (
                    <a href={tile.href} className="break-words font-semibold text-trust-blue underline-offset-4 hover:underline">
                      {tile.value}
                    </a>
                  ) : (
                    tile.value
                  )}
                  {tile.note && <span className="mt-2 block text-[length:var(--text-caption)] text-graphite">{tile.note}</span>}
                </dd>
              </div>
            ))}
            {socials.length > 0 && (
              <div className="rounded-3xl rounded-tr-[3rem] bg-mist p-7 md:p-8">
                <dt className="text-[length:var(--text-caption)] font-semibold uppercase tracking-[0.16em] text-trust-blue">
                  {labels.social}
                </dt>
                <dd className="mt-3">
                  <ul className="flex flex-wrap gap-x-5 gap-y-2">
                    {socials.map((s) => (
                      <li key={s.platform}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-trust-blue underline-offset-4 hover:underline"
                        >
                          {s.label}
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
        )}
      </Container>
    </section>
  );
}
