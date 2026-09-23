import Container from "../Container/Container.jsx";

/* The contact block: a heading and intro, then the four ways to reach
   the organisation as tiles. Phone numbers and addresses are real links
   (tel:, mailto:) so a phone can act on them. */

const ICONS = {
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />,
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="m2 7 10 7 10-7" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
};

function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-6 w-6"
    >
      {ICONS[name]}
    </svg>
  );
}

function Line({ line }) {
  if (line.href) {
    return (
      <a href={line.href} className="break-all hover:underline underline-offset-4">
        {line.text}
      </a>
    );
  }
  return line.text;
}

export default function ContactDetails({ heading, subheading, body, tiles }) {
  return (
    <section className="py-20 md:py-28">
      <Container>
        <div className="reveal max-w-3xl">
          <h1 className="font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg md:text-[length:clamp(3.5rem,5vw,4.5rem)]">
            {heading}
          </h1>
          <p className="mt-4 font-bold text-[length:var(--text-heading-sm)] leading-heading-sm tracking-heading-sm">
            {subheading}
          </p>
          <p className="mt-4 text-graphite">{body}</p>
        </div>

        <ul className="reveal mt-14 grid gap-cards sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => (
            <li key={tile.title} className="rounded-3xl rounded-tr-[3rem] bg-mist p-8">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-paper-white text-bumble-honey">
                <Icon name={tile.icon} />
              </span>
              <h2 className="mt-6 font-bold text-[length:var(--text-subheading)] leading-subheading tracking-subheading">
                {tile.title}
              </h2>
              <ul className="mt-3 flex flex-col gap-1 break-words text-graphite">
                {tile.lines.map((line) => (
                  <li key={line.text}>
                    {line.label && <span className="text-bumble-ink">{line.label}: </span>}
                    <Line line={line} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
