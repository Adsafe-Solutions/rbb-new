# Content readiness — Rising Beyond Borders website

Document 19. What is on the site now, where each item came from, and what
RBB must supply or approve before launch. **No content in this record was
invented to fill a gap** — where there is no approved source, the site keeps
its pending state. See `docs/CONTENT_GUIDE.md` for how content is entered.

Status of this record: **no new RBB source material has been supplied
since Document 18.** Nothing was populated; this phase audited the existing
content, corrected three places where the site's output contradicted the
readiness rules (below), and records the gaps.

**Update (Document 27).** Still no new RBB source material. What changed
is where the stand-in content lives: the separate staging content tree was
removed, and its self-labelled WORKING PLACEHOLDER records are now
ordinary published content in the normal files, so `npm run dev` and
`npm run build` both show the complete website
(`docs/WORKING_CONTENT.md`). The classes below are unchanged, and
**nothing was invented**: every placeholder says on its face that it is
one, and the items that cannot carry such a label — impact figures,
financial percentages and every document — are still Pending or Missing,
exactly as this record says. `npm run release:status` now reports what is
left to replace.

## Source classes

| Class | Meaning | May publish? |
| --- | --- | --- |
| **Source-confirmed** | In the material RBB supplied (annual report, presentation, brand) | Yes |
| **RBB-approved proposal** | Wording proposed by the project team and approved by RBB | Yes |
| **Proposed** | Interface copy written for the site (headings, labels, button text), awaiting RBB sign-off | Shown as interface copy only — never states a fact |
| **Pending** | Supplied, awaiting RBB verification | Only with its pending note |
| **Missing** | No approved source | No — the section keeps its placeholder or empty state |

## Inventory by area

| Area | Item | Class | On the site |
| --- | --- | --- | --- |
| Brand | Name "Rising Beyond Borders", summary "A non-profit focused on empowering communities and creating sustainable solutions." | Source-confirmed | Everywhere |
| Home | Hero headline "Building Hope. Creating Change. Transforming Lives." | Source-confirmed | Home |
| Home | Hero supporting line | Missing | Placeholder |
| Home | Approach section | Pending | Heading, placeholder intro and link only (see correction 1) |
| Home | Featured work, stories | Missing | Empty-state slots |
| About | Who we are (first paragraph) | Source-confirmed | About |
| About | Mission and vision | Source-confirmed (exact wording on About and Our Approach) | See question Q1 |
| About | Values, How We Work detail, team | Missing | Placeholders |
| Programs | Four names and one-line descriptions | Source-confirmed | Consistent on Home, Work, program pages, Donate, metadata (checked) |
| Programs | Projects, outcomes, imagery | Missing | Empty states |
| Impact | 50K+ lives, 25 countries, 200+ partners & donors | **Pending** | Home and /impact, with "pending final verification" (see correction 2) |
| Impact | The "120+" figure | Excluded | Nowhere; the build fails if it appears |
| Impact | Program impact, geography, approach, measurement, reports | Missing | Placeholders; /impact/where-we-work and /impact/our-approach are noindex |
| Stories | All | Missing | Empty directory (noindex) |
| Team | All people, roles, groups, photos | Missing | Empty state (noindex) |
| Transparency | 2026 split 78 / 12 / 10 | **Pending** | /about/transparency, with "pending final verification" |
| Transparency | Annual reports, financial documents, governance | Missing | Placeholders |
| Contact | Email, phone, address, hours, social | Missing | Placeholders; nothing invented |
| Donation | Provider, currency, amounts, methods, tax/receipt/refund wording | Missing | Pending state; no payment |
| Policies | Privacy, Terms, Accessibility | Missing | Pending pages (noindex); no footer links |
| Policies | Cookies | Not assessed | No page (404) until the host is audited |
| Forms | All | Missing (no approved destination or privacy policy) | Disabled |

## Corrections made in this phase

1. **Approach steps.** The homepage showed Listen → Partner → Act → Sustain
   under "Our approach". RBB has not approved it as its methodology
   (Document 19 §5), and the steps were duplicated in `homepage.js` and
   `impact.js`. They now live once, in `impact.js`
   (`approach.proposedFramework`), and appear on the homepage only when its
   status is approved. Until then the section is its heading, intro and
   "Learn How We Work" link.
2. **Impact figures.** 50K+, 25 and 200+ are `pending-review`, but Home and
   /impact showed them with only their source line, while the 78 / 12 / 10
   figures on Transparency carry "pending final verification". Both sets
   now carry the same note (`SITE.figuresPending`, one shared string). It
   disappears automatically when every figure is marked verified.
3. **Legacy appeal pages retired.** Twenty addresses from the site this one
   replaced (Gaza, Sudan and Yemen emergency appeals, Sponsor an orphan,
   Build a well, Zakat sub-pages, gift catalogue, app and membership pages)
   were kept as "to be provided" stubs in Document 01 because links pointed
   at them. Nothing links to them any more, and since Document 15 each was
   published as a page headed with another charity's appeal. They are no
   longer routed and return the not-found page (noindex) — deliberately
   not redirected, since sending an appeal's address to Donate would imply
   the appeal. Published pages: 48 → 28.

## Verification queue — needs RBB

1. **Impact figures** 50K+ / 25 / 200+: verify, correct or withdraw each.
2. **Financial overview** 78 / 12 / 10: verify.
3. **The "120+" figure**: clarify what it counts, or confirm it stays out.
4. **Mission and vision**: confirm the web wording. (Q1)
5. **Values**: the approved list.
6. **How We Work**: is there an official framework? Is Listen → Partner →
   Act → Sustain it?
7. **Team**: people, roles, groups, biographies, photos, order, consent.
8. **Projects**: titles, descriptions, programs, locations, stage,
   impact, partners, approved images.
9. **Where We Work**: countries/regions, if the section should be populated.
10. **Stories**: approved stories with authors, dates, images, quotes.
11. **Reports and financial documents**: the real files.
12. **Contact**: official email, phone, address, office, social, hours.
13. **Donation**: provider, currency, methods, recurring giving,
    tax/receipt/refund wording, the final process.
14. **Policies**: reviewed Privacy, Terms and Accessibility text and dates;
    the Cookies decision after the host audit.
15. **Hero supporting line** and all **proposed interface copy** (headings,
    labels, pending lines, "Something went wrong").

### Open questions

- **Q1 — mission/vision framing.** The approved statements appear verbatim
  on /about and /impact/our-approach. Three pages (/about/team,
  /get-involved, /get-involved/donate) introduce the mission in a sentence
  — "Our mission is to empower vulnerable communities…" — and Donate does
  the same for the vision ("Our vision is a world beyond borders…"). The
  statement's words are unchanged, but its first letter is lower-cased and
  it is framed. Confirm this is acceptable, or the pages will quote the
  statements exactly under an "Our mission" label instead.
- **Q2 — Home and Impact figures with a pending note.** Correction 2 keeps
  the figures on the page with the note, matching Transparency. If RBB
  prefers unverified figures not to appear at all before launch, set their
  display off rather than removing the records.

## Media inventory

Every image a published page shows. **Approval as a depiction of RBB's work
is required before launch** — Document 19 §8.

| Image | Source | Licence / permission | Used on | Status |
| --- | --- | --- | --- | --- |
| `rbb-field-kids.jpg` | Supplied by RBB (compressed from PNG) | RBB's own | Home (hero) | Read as illustrative rather than documentary, and carry RBB-branded signage; **RBB to confirm they may be presented as photographs of its work** |
| `rbb-field-distribution.jpg` | Supplied by RBB | RBB's own | Home (Who we are) | As above |
| `rbb-field-elder.jpg` | Supplied by RBB | RBB's own | Home, Donate (closing) | As above |
| `ngo-volunteers.jpg` | Pexels — RDNE Stock Project (6646918) | Free licence | /giving (legacy, noindex) | **Stock; could be read as RBB field work — decision needed** |
| `ngo-events.jpg` | Pexels — Quyn Phạm (13418669) | Free licence | /giving, /gifts, /giving/major-giving | Same |
| `gifts-hero.jpg` | Pexels — Dauphotographer (35106287) | Free licence | /gifts, /giving/major-giving | Same |
| `zakat-hero.jpg` | Pexels — Shkraba Anthony (7345444) | Free licence | /giving/zakat | Same |
| `ngo-classroom.jpg` | Stock (credit not recorded) | Unconfirmed | /giving/zakat | **Licence to confirm**; same decision |

All published photos are served through `components/Picture` with
responsive WebP copies (Document 15). The four legacy pages are noindex and
unlinked from the navigation; RBB should decide whether they launch at all
(Document 11 left their purpose to RBB). Check mobile and desktop crops
separately when any approved image is added.

## Pages launching with placeholder text

Every page intended to launch currently carries at least one "to be
provided by Rising Beyond Borders" line — expected, since no new content has
been supplied. Before the content freeze, each remaining placeholder needs
either its approved content or an explicit RBB decision that the section
launches empty (Document 19 §9).

## Final content freeze

A launch-control step, not a feature. When RBB approves the launch set:

1. `npm run validate:content` — no problems.
2. `npm run build` — passes; the `content:` line shows exactly the expected
   approved records and `0 records held back` unless drafts are knowingly
   in the files.
3. Check `build-meta/content-report.json`, `routes.json` and (with the
   domain set) `sitemap.xml`.
4. Run the route, redirect, accessibility, SEO and hydration checks.
5. RBB signs off; tag the commit (e.g. `content-freeze-<date>`).

After the freeze every content change repeats steps 1–5 and needs RBB's
approval before deployment.
