import { useState } from "react";
import Button from "../Button/Button.jsx";
import Container from "../Container/Container.jsx";

/* A single-field sign-up on a Light Gray card — the volunteer form. Nothing is
   sent yet; it validates and confirms in place so a backend is a drop-in
   behind `onSubmit`. */
export default function SignupCard({ heading, body, consent, cta }) {
  const [done, setDone] = useState(false);

  return (
    <section className="py-10 md:py-16">
      <Container>
        <div className="reveal mx-auto max-w-3xl rounded-3xl rounded-br-[5rem] bg-mist p-8 text-center md:p-14">
          <h2 className="font-bold text-[length:var(--text-heading-lg)] leading-heading-lg tracking-heading-lg">
            {heading}
          </h2>
          <p className="mt-4">{body}</p>

          {done ? (
            <p className="mt-8 rounded-2xl bg-paper-white px-6 py-4 font-medium">
              Thanks — we'll be in touch.
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setDone(true);
              }}
              className="mx-auto mt-8 flex max-w-lg flex-col gap-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="flex-1">
                  <span className="sr-only">Email address</span>
                  <input
                    type="email"
                    required
                    placeholder="Your Email"
                    className="w-full rounded-2xl bg-paper-white px-5 py-4 outline-none ring-bumble-ink focus:ring-2"
                  />
                </label>
                <Button type="submit">{cta}</Button>
              </div>
              <label className="flex items-start justify-center gap-3 text-[length:var(--text-caption)] tracking-caption">
                <input type="checkbox" required className="mt-1 h-4 w-4 accent-bumble-ink" />
                {consent}
              </label>
            </form>
          )}
        </div>
      </Container>
    </section>
  );
}
