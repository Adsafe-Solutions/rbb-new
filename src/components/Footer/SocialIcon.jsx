/* The six social marks, drawn inline.

   An icon package for six fixed glyphs is a dependency and a bundle cost
   for something that never changes. These are simplified single-path marks
   at a common 24px box, which is what keeps the row optically even — the
   brand SVGs are each drawn to their own grid and line up badly side by
   side.

   `currentColor` throughout, so the row takes its colour from the footer
   rather than carrying brand colours of its own — the design admits no
   chromatic colour beyond the two yellows. */
const PATHS = {
  instagram: (
    <>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        fill="none"
        strokeWidth="2"
        stroke="currentColor"
      />
      <circle cx="12" cy="12" r="4" fill="none" strokeWidth="2" stroke="currentColor" />
      <circle cx="17.2" cy="6.8" r="1.2" />
    </>
  ),
  facebook: (
    <path d="M13.5 21v-8h2.7l.4-3h-3.1V8.2c0-.9.3-1.5 1.5-1.5h1.7V4.1A22 22 0 0 0 14.3 4C12 4 10.5 5.4 10.5 8v2H8v3h2.5v8z" />
  ),
  x: (
    <path d="M17.5 3h3l-6.6 7.5L21.7 21h-6l-4.3-5.6L6.4 21H3.3l7-8L2.6 3h6.2l3.9 5.2zm-1.1 16h1.7L7.7 4.8H5.9z" />
  ),
  linkedin: (
    <>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3"
        fill="none"
        strokeWidth="2"
        stroke="currentColor"
      />
      <circle cx="8" cy="8.2" r="1.3" />
      <path d="M7 10.6h2v7H7zm4 0h1.9v1a2.6 2.6 0 0 1 2.3-1.2c1.8 0 2.8 1.1 2.8 3.2v4h-2v-3.6c0-1-.4-1.7-1.3-1.7s-1.7.7-1.7 1.8v3.5h-2z" />
    </>
  ),
  youtube: (
    <>
      <rect
        x="2.5"
        y="5.5"
        width="19"
        height="13"
        rx="4"
        fill="none"
        strokeWidth="2"
        stroke="currentColor"
      />
      <path d="M10.3 9.2 15 12l-4.7 2.8z" />
    </>
  ),
  tiktok: (
    <path d="M14 3h2.6a5.3 5.3 0 0 0 4.4 4.4V10a7.9 7.9 0 0 1-4.4-1.5v6.2A5.7 5.7 0 1 1 11 9v2.7a3 3 0 1 0 3 3z" />
  ),
};

export default function SocialIcon({ name, className = "h-5 w-5" }) {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      {path}
    </svg>
  );
}
