# REFERENCE_WEBSITE_REVERSE_ENGINEERING.md

**Reference:** https://amjadformayor.ca/ (inspected 4 Oct 2026, desktop viewport 1534 × 865 CSS px, Chrome)
**Purpose:** A visual, interaction and motion spec of the reference site, written so the **Rising Beyond Borders (RBB)** site can later be rebuilt with the same level of craft. **No RBB code was touched.** No packages were installed, no components were created and nothing was committed.
**Scope rule:** This document describes **design and experience only**. Political names, claims, copy, imagery and election material are deliberately left out, or appear only as structural placeholders like `[Headline line 1]`.

### Evidence labels used throughout

| Label | Meaning |
|---|---|
| **OBSERVED** | Seen directly in the browser: computed styles, measured boxes, screenshots, the shipped CSS/JS read as text, or the network/DOM. |
| **LIKELY** | Strongly implied by the evidence but not confirmed by an interaction or a source line. |
| **UNKNOWN** | Couldn't be determined. Listed in §27. |

Most numbers below come straight from the site's own stylesheets (`main.css`, `poster.css`, `about.css`) and its scripts (`main.js`, `about.js`, `townhall-pop.js`), which I read as text, plus measured `getBoundingClientRect()` boxes. Those count as **OBSERVED**. Pixel values at a specific viewport are measured at **1534 px wide (1519 px without the scrollbar)** unless I say otherwise.

> **Inspection gap, mobile:** every public route was screenshotted at desktop width. Real mobile rendering **could not be captured**: the browser window couldn't be resized from the extension, and the site sends `X-Frame-Options: DENY`, which blocks iframe emulation. All mobile/tablet behaviour in this document comes from the **shipped CSS media queries and JS breakpoints** (exact values, but not visually verified). It's labelled where it matters and collected in §27.

---

## 1. Executive Summary

The reference site is a **hand-built, framework-free static site** (plain HTML + two global stylesheets + a vanilla-JS file + small page-specific CSS/JS, PHP endpoints for forms). Its visual idea is spelled out in the stylesheet header: **"the site as printed campaign material — flat blocks of the brand's three colours, big type, grain, the mark everywhere."**

The six ideas that make it work, in order of importance:

1. **A three-colour print palette**: matte ink `#28282B`, ivory/cream paper (`#faf4e8` cards on a `#f4e8d2` page) and one electric accent (`#0ff0fc`). Sections are **full-bleed colour blocks** that alternate paper → ink → accent → paper → ink footer. The rhythm comes from the blocks themselves, not from imagery.
2. **"Sticker / flyer" objects**: cards are flat paper rectangles with a **2 px ink border** and a **hard, blur-free offset shadow in the accent colour** (`5–10px 5–10px 0`). Many are **tilted by ±0.8–2.5°** "like they were stuck up by hand", and they straighten and lift on hover.
3. **One dramatic display face**: a textured, slanted, all-caps display font (Eveleth Slant) at billboard sizes, with line-height 0.9–0.98, set against a technical sans (IBM Plex Sans) and a mono (IBM Plex Mono) for labels and metadata.
4. **The highlighter / "print pass" motif**: key words sit on a flat accent-colour box. On hero and billboard headlines, a **cyan bar wipes across each line and the text is revealed behind it**, line by line.
5. **The brand mark used as a graphic system**: one SVG symbol, applied with `mask-image`. It turns up as a huge faint watermark, chapter stamps, list bullets, double-printed "misregistered" icons, a rotating circular sticker in the corner, a marquee separator, a loader and a footer badge.
6. **Restrained but characterful motion**: a one-time loader, then a staged hero entrance (wipe + rise + pop). After that come IntersectionObserver reveals (rise 26–28 px), gentle scroll parallax on three hero layers, a marquee, a slowly rotating badge, and one ambitious **scroll-driven sticky "wheel"** on the strategy page. Every animation has a `prefers-reduced-motion` fallback.

Underneath the current light "poster" theme sits an older **dark "glass" theme** (dark green-black background, cyan glows, frosted panels) that is still in `main.css`. The poster layer flips it by swapping tokens on `body.poster`. Every public page currently ships `body.poster` (**OBSERVED** on /, /about, /platform, /strategy/auto-theft, /donate). The dark theme is documented briefly in §4.4 because it's a ready-made "dark mode" vocabulary.

---

## 2. Route Inventory

How the routes were found: header, footer and in-page links, plus URL probing with `fetch()` (no sitemap.xml: it returns 404). Status codes are **OBSERVED**.

| URL | Status | Purpose (design terms) | Major sections (in order) | Unique patterns | Reused patterns | Interaction | Animation |
|---|---|---|---|---|---|---|---|
| `/` | 200 | Landing page / front door | Full-screen paper hero → ink "4 flyers" block + marquee → accent block (headline + inline stamp number + reminder form + paper steps card) → paper "billboard headline + 3 action boxes" → ink footer | Cut-out portrait anchored to the bottom edge with a tilted label sticker; ribbon-wipe headline; giant faint mark with parallax; scroll cue | Flyer card, ribbon headline, marquee, accent block, offset-shadow boxes | Flyer hover lift; link rows slide on hover; form | Loader, hero timeline, parallax (3 layers), reveals, marquee, rotating badge |
| `/about` | 200 | Person/organisation story | Paper split hero (copy + tilted video phone + "jump" sticker pills) → ink "Who I am" (kicker 01/04, highlighted headline, pull-quote, 2-col text, marquee) → accent "Direct answers" (chat-thread Q&A + stat card) → paper "What we're fighting for" (4 linked flyers with arrow stamps) → ink closing (action rows + calendar ticket) | Chat-bubble Q&A; video "phone" with hover-peek; numbered chapter kickers; "ticket" card | Flyer, ribbon headline, marquee, highlight words, count-up | Video play/peek; jump-links; flyer arrow nudge; action rows | Reveals (sides for Q/A bubbles), count-up stats |
| `/platform` (`/platform.html` resolves here) | 200 | Strategy hub (6 items) | Centered hero with highlighted word → scroll-driven sticky dial + 6 long panels → CTA band | **Sticky SVG dial that rotates to the panel being read; outer progress ring; inactive panels blurred** | Panel card, rules list, CTA band | Click a wedge → smooth-scroll to its panel | Marker spring rotation, label cross-fade, panel focus/blur |
| `/strategy/<slug>` e.g. `/strategy/auto-theft`, `/strategy/cost-of-living`, `/strategy/gridlock` (+3 more, slugs not all discovered) | 200 | Individual item detail ("mandate") | Breadcrumb hero → 300 px sticky stat rail + long-form body (Problem / Plan numbered list) → prev / all / next pager → centered CTA band | Sticky stat rail; 01/02/03 rounded-square numbered plan list; 3-part pager | Stat card, CTA band | Pager hover | Reveals |
| `/strategy/` | 403 | (directory listing blocked) | — | — | — | — | — |
| `/volunteer` | 200 | Volunteer sign-up | Hero (eyebrow + H1 with highlighted last word + sub) → one form of **3 numbered step cards**: (1) identity fields in a 2-col grid incl. a postal code + optional select, (2) interest checkbox cards in a **2 × 3 grid**, (3) optional textarea + consent checkbox card + full-width ink submit | — | Step card, checkbox card, field | Validation | Unfold card, checkbox rows deal in |
| `/donate` | 200 | Donation flow | Hero (eyebrow + headline w/ highlighted word + sub) → one `<form>` of **4 numbered step cards** (Amount → Your information → Eligibility → Payment method) → legal/notes band | Amount tiles; payment-method tiles; live summary box; numbered step cards | Step card, field, checkbox card, chip | Tile select, custom amount, validation, submit disabled state | Unfold per card, step-number stamp |
| `/contact` | 200 | Contact options | (confirmed: document height = viewport height, 894 = 894) centered hero with the mark as logo → 3 contact cards (icon, title, mono handle, text, full-width button) → closing line. **On ≥760 px the whole page is designed to fit one screen with no scroll.** | Single-screen layout using vh-based spacing | Card, icon tile | Card buttons | Reveals |
| `/join` | 200 | Single-action funnel (QR/ad landing) | **No nav** (only the corner badge); centred mark → eyebrow → word-by-word 3-line headline (last word highlighted) → aside note with accent left rule and a lower-half highlighter phrase → unfolding form card (name, "email or phone" single field, optional postal code, full-width submit, mono consent fineprint) → exits after the form → mini footer. (Chip styles exist in CSS; not seen in the current form.) | Word-by-word headline; growing highlight; submit button with periodic sheen; no-nav funnel | Field, chips, consent | Chip toggles, validation | Stamp, word rise, highlight grow + kick, unfold, sheen loop |
| `/privacy` | 200 | Legal text | `<article class="legal">` in a **776 px column**: eyebrow → H1 with highlighted word → mono "LAST UPDATED" line (10.5 px) → intro paragraph with accent left rule → stack of **numbered legal cards** (step-card styling: accent number circle + H2 22.4 px + bullet list with bold lead-ins) | Long legal text broken into numbered paper cards | Step card, highlight H1 | — | Unfold per card |
| `/townhall` | 200 | Time-limited event page | Reached only via a timed top bar (`townhall-pop.js`, expired 3 Oct 2026) | Floating announcement bar under nav | — | Dismiss | Bar slides in |
| `?joined`, `?confirmed`, `?unsubscribed`, `?sent`, `?thanks` on any page | — | Post-submit confirmations | Toast inserted at top of `<main>`, `role="status"`; query string removed with `history.replaceState` | — | Toast | — | — |
| `/api/hit.php`, `/api/banner.php` | — | First-party analytics beacon / announcement bar feed | — | — | — | — | — |

**Global elements on every poster page (OBSERVED):** skip link → sticky pill nav → `<main id="main">` → ink footer. Injected by JS: a **rotating circular corner sticker** (fixed), a **WhatsApp slide-in prompt** (once per visitor, opt-out per page with `data-wapop="off"`), and an optional **site-wide announcement bar** (fetched).

**Navigation inconsistency (OBSERVED):** the mandate page's nav has 4 links (no "About"), while the homepage, About and Donate have 5. The detail pages probably have older markup. Treat 5 as canonical.

---

## 3. Visual Identity

| Trait | Concrete expression |
|---|---|
| Metaphor | Screen-printed street poster / flyer wall. Flat inks, no gradients on the poster layer, paper grain over everything, misregistered double prints, stickers, tickets, stamps. |
| Palette discipline | Three brand colours with a declared ratio in the CSS header: **ink 60% · ivory 30% · accent 10%**. Muted warm grey for secondary text. Green (`#25d366`/`#1fae54`) appears only on WhatsApp elements; red only for errors. |
| Shape language | Full pills (`999px`) for buttons, nav, chips and inputs. 14–18 px radius for cards. 26–28 px for phone frames. 6–10 px for small stamps. Circles for icon discs. |
| Depth model | **No blur shadows on the poster layer.** Depth comes from **hard offset shadows** (`Npx Npx 0 <accent or ink>`) and from overlap/z-index (the portrait sinks behind the next block). |
| Texture | `grain.svg` tiled at 180 px over the whole viewport (`position:fixed; z-index:90; opacity:.32; mix-blend-mode:multiply; pointer-events:none`). |
| Tilt | Flyers −1.1° / +0.9° / +0.8° / −0.9°; video phone −2.5°; ticket +1.6°; label sticker −4°; stamp numbers −2° to −3°; brand mark watermarks ±8°. |
| Voice of the UI | Labels in mono uppercase with wide tracking ("MANDATE 01", "SOURCE", "← MANDATE 03"). Headings in shouting display caps ending with a full stop. |

---

## 4. Color System

### 4.1 Poster tokens (current live theme) — OBSERVED from `poster.css`

| Token | HEX | Role | Where used |
|---|---|---|---|
| `--pi` (ink) | **#28282B** | Primary dark / text / dark blocks | All body text and headings on paper; ink section blocks; footer; solid buttons; 2 px borders; icon discs; stamp numbers; the portrait label sticker |
| `--pp` (paper / ivory) | **#FAF4E8** | Card surface / light text on ink | Flyer cards, nav pill, step cards, tickets, chat question bubbles; text colour on ink blocks |
| `--pbg` (page) | **#F4E8D2** | Page background (warmer cream) | `body` background; paper sections are transparent over it |
| `--pfield` | **#FDF8EE** | Form-field / chip surface | Inputs, amount tiles, checkbox cards, chips, pager links |
| `--pc` (accent) | **#0FF0FC** | Accent / highlight / shadow | Highlight boxes behind words, offset shadows, accent section block, ribbon wipe bar, the mark on paper, selected states, focus outline ring (3 px), underline decoration on links |
| `--mut` | **#625E56** | Secondary text | Paragraphs inside cards, captions, fineprint |
| `--panel-edge` | `rgba(40,40,43,.22)` | Hairlines | Dividers, inactive borders |
| Ink-on-ink text | `rgba(250,244,232,.82)` / `.6` | Body text on ink blocks / footer legal | About "Who I am" columns; footer |
| WhatsApp green | `#1FAE54` (poster) / `#25D366` (legacy) | Brand-of-channel only | WhatsApp button outline/hover; WhatsApp icon tile |
| Error red | `#FF6B6B` | Validation | Invalid field border + 3 px halo `rgba(255,107,107,.18)`; error text |
| Warning amber | `#FFD97A` | Admin/legal banner | Dashed `.banner` notice, `.todo` |

### 4.2 Measured application (OBSERVED, computed)

- `body` background `rgb(244,232,210)`. Section `.pp` (ink block) `rgb(40,40,43)`. Section `.pc` (accent block) `rgb(15,240,252)`. Section `.pa` transparent, so paper.
- Nav pill `rgb(250,244,232)` with `2px solid #28282B`.
- Primary button: `background:#28282B; color:#FAF4E8`; on hover it turns `background:#0FF0FC; color:#28282B`.

### 4.3 Color-combination rules (the important part)

1. **Section sequence (homepage):** paper (hero) → **ink** → **accent** → paper → **ink** (footer). On About: paper → ink → accent → paper → ink → ink footer. **The same colour never appears twice in a row**, except where the closing ink block meets the ink footer on About.
2. **The accent is never used as text colour on paper.** The CSS states it outright ("cyan type was written for ink surfaces; on paper it goes to ink"). On paper, emphasis = **ink text on an accent box**. On ink, accent text is allowed (marquee text, the label sticker's text, stamp numerals).
3. **Card-on-block contrast inversion:**
   - On paper and ink blocks, cards are **paper with an accent shadow**.
   - On the accent block, the card is **paper with an ink shadow** (`8px 8px 0 #28282B`).
   - In the 3-box action row, each box takes a different colour (accent box with ink shadow / ink box with accent shadow / paper box with ink border and accent shadow). Same size and weight, different colours, read as one set.
4. **Colour does not encode categories.** The four flyers and six strategy panels all share one style. Colour encodes **surface level and emphasis**, not taxonomy.
5. **Backgrounds do not change while scrolling** (no scroll-linked colour transitions). The only scroll-linked visual changes are parallax, the strategy wheel's focus/blur, and the progress ring.
6. **Faint marks:** the mark watermark is ink at **4.5% opacity** on paper (hero), ink at **9%** on the accent block, and paper at **5%** on ink (About closing).

### 4.4 Legacy dark "glass" tokens (in `main.css`, overridden on poster pages) — OBSERVED in source, not visible live

`--ink #28282B`, `--ink-2 #222225`, `--panel #2E2E33`, `--paper #FAF4E8`, `--cyan #0FF0FC`, `--cyan-deep #0AAEB6`, `--mut #A9A395`, `--panel-edge rgba(15,240,252,.16)`. Page: `#070A09` with three radial glows (`rgba(13,90,78,.55)` top-left, `.42` bottom-right, faint cyan top-right). Panels: `linear-gradient(170deg, rgba(24,33,31,.5), rgba(9,13,12,.55))` + `backdrop-filter: blur(10px)` + 1 px cyan-tinted border + `inset 0 1px 0 rgba(255,255,255,.05)` top highlight + `0 22px 54px rgba(0,0,0,.35)` drop. Headings: paper fill with grain through `background-clip:text` and a soft white `drop-shadow(0 0 26px rgba(250,244,232,.3))`. Accent words glow (`text-shadow:0 0 28px rgba(15,240,252,.5)`). Animated background layers: drifting mark (70 s), two drifting line SVGs (90 s / 130 s), three "breathing" radial glows (17 / 23 / 28 s, `mix-blend-mode:screen`). This is a complete dark-mode vocabulary built on the same three brand colours.

---

## 5. Typography

### 5.1 Families — OBSERVED (`document.fonts` loaded set + CSS)

| Role | Family | Source | Weights loaded |
|---|---|---|---|
| Display | **Eveleth Slant** (textured, slightly slanted, wide all-caps face; rough "printed" edges) | Self-hosted `/assets/fonts/EvelethSlant.woff2`, `font-display:swap` (commercial licence noted in CSS) | 400 |
| Display fallback | Archivo Black | Google Fonts | 400 |
| Body / UI | **IBM Plex Sans** | Google Fonts | 400, 500, 600, 700 |
| Labels / metadata | **IBM Plex Mono** | Google Fonts | 400, (500 requested), 600 |

Note: `.btn` declares `font-weight:800` in the legacy layer, but Plex Sans only loads up to 700. The poster layer sets buttons to 700 explicitly.

### 5.2 Global rules
- `h1, h2, h3`: display family, **`text-transform: uppercase` always**, base `line-height:1.04`. On poster pages `letter-spacing:-0.015em` (slightly tight). Legacy layer used `+0.01em`.
- Body: Plex Sans 16 px, `line-height:1.55`, `-webkit-font-smoothing: antialiased`.
- Numbers in countdowns/stats use `font-variant-numeric: tabular-nums`, and stat tiles have fixed heights so count-ups never resize the layout (stated in CSS).

### 5.3 Hierarchy (values = CSS declaration → measured at 1519 px)

| Level | Family / weight | Size rule | Measured | Line-height | Tracking | Case | Notes |
|---|---|---|---|---|---|---|---|
| **Display (hero)** | Eveleth 400 | `clamp(2.8rem,14vw,6.4rem)`; ≥1000 px `clamp(2.8rem,6.6vw,6rem)` | **96 px** | 0.92 (88 px) | −0.015em | UPPER | 3 short lines, each a "ribbon"; ends with a period |
| **Display (billboard H2)** | Eveleth | `clamp(2.4rem,6.6vw,5.4rem)` | **86.4 px** | 0.90 | −0.015em | UPPER | 2 lines, ribbon wipe |
| **H1 (inner pages)** | Eveleth | generic `clamp(2.1rem,8.4vw,4.2rem)`; About `clamp(3rem,5.6vw,5rem)` ≥900; mandate `clamp(1.85rem,6.4vw,3.2rem)`; contact `clamp(2.3rem,4.6vw,3.3rem)`; join `clamp(1.8rem,7.4vw,2.7rem)` | ≈ 64–67 px (Privacy measured 64 px) | 0.9–1.04 | −0.015em | UPPER | Highlighted final word on accent box |
| **H2 (section, accent block)** | Eveleth | `clamp(2rem,5.8vw,3.6rem)` (≥960) | **57.6 px** | 0.98 | — | UPPER | `max-width:16ch` forces 4–5 line stack |
| **H2 (generic)** | Eveleth | `clamp(1.55rem,5vw,2.5rem)` | ~40 px | 1.04 | — | UPPER | `margin-bottom:.55em` |
| **H2 (flyer card)** | Eveleth | `clamp(1.5rem,3.2vw,2.1rem)` | **33.6 px** | 1.02 | — | UPPER | 2 lines typical |
| **H3 (panel)** | Eveleth | `clamp(1.15rem,4.4vw,1.35rem)` | ~21.6 px | 1.15 | — | UPPER | — |
| **H3 (action box)** | Eveleth | `clamp(1.35rem,2.1vw,1.7rem)` | 27.2 px | 1.0 | — | UPPER | `max-width: calc(100% − 104px)` to clear the corner sticker |
| **Lead / hero sub** | Plex Sans **500** | `clamp(1.25rem,2.7vw,1.75rem)` | **28 px** | 1.3 | 0 | Sentence | `max-width:24ch` (2 lines) |
| **Statement line** (accent block) | Plex Sans 500 | `clamp(1.4rem,3.3vw,2.2rem)` | 35.2 px | 1.3 | 0 | Sentence | `max-width:30ch`; contains an inline display "stamp" number |
| **Eyebrow (poster)** | Plex Sans **700** | 1rem | 16 px | — | 0 | Sentence | Ink, often preceded by the mark icon |
| **Kicker / chapter stamp** | Plex Mono **700** | .85rem | 13.6 px | — | .14em | UPPER | Leaf icon 26×21 + "01 / 04" |
| **Body** | Plex Sans 400 | 1rem (cards 1.02–1.05rem) | 16–16.8 px | 1.5–1.58 | 0 | Sentence | Card copy `max-width:40ch`; long-form `max-width:62ch`, `line-height:1.7` |
| **Small / fineprint** | Plex Sans 400 | .85rem | 13.6 px | — | 0 | Sentence | Muted; links in ink |
| **Metadata (mono)** | Plex Mono 500–600 | .62–.72rem | 10–11.5 px | 1.5 | .06–.16em | UPPER | "SOURCE", "MANDATE 01", amount captions, step legends, footer legal (10.88 px) |
| **Button** | Plex Sans **700** | .95rem | 15.2 px | — | 0 | **Sentence case** (poster) | Legacy layer was UPPER .8rem +.08em; poster removed caps |
| **Nav link** | Plex Sans 600 | `clamp(.8rem,2.4vw,.95rem)` | 15.2 px | — | 0 | Sentence | `opacity:.72`, 1.0 when hovered/active |
| **Brand lockup** | Eveleth .8rem + Plex 600 .55rem | — | 12.8 px / 8.8 px | 1 | .06em / .26em | UPPER | Sub-line preceded by a 20×3 px accent dash |

### 5.4 Typography as a visual element (OBSERVED)
- **Oversized headlines occupy ~70% of the content width.** The hero H1 box is 1076 px wide (full wrap), but the longest line ("[line 3]") fills ~600 px ≈ **40% of the viewport**, leaving the right half for the portrait. Accent-block H2 is capped at `16ch`, about 600 px.
- **Line breaks are authored**, one `<span class="ribbon">` per line (3 lines in the hero, 2 in the billboard). Lines are kept short (1–3 words).
- **Every headline ends in a full stop.** That's a stylistic signature.
- **Highlighted words**: `.glow` is a flat accent box behind ink text (`padding:0 .1em; box-decoration-break:clone`). On the inner-page H1s, the **last word** of the headline is highlighted. Inside ink blocks the highlight is `display:inline-block` with `line-height:.98` so it doesn't overpaint the line above.
- **Inline "stamps"**: a number inside a sentence becomes a display-font ink box with accent text, rotated −2° (`.pc-days`).
- **Typography overlapping imagery:** the hero label sticker overlaps the portrait's arm. Headline and portrait don't overlap at desktop; the portrait sits in the right ~45%.
- **Pull-quote** (About): display caps `clamp(1.5rem,3.6vw,2.7rem)`, `line-height:1.02`, `max-width:30ch`, with one highlighted phrase.

---

## 6. Layout System

### 6.1 Containers — OBSERVED
| Item | Value |
|---|---|
| Max content width | `--wrap: 1120px`, with `padding: 0 22px` → **1076 px usable** |
| Page side gutter (mobile) | 22 px (`.wrap` padding); nav wrapper 16 px |
| Nav max width | 1120 px (same as wrap) |
| Measured | `.ph .wrap` at x = 200 → 1320 (centred in 1519) |
| Narrow containers | Donate form 760 px; Join 560 px; About Q&A thread 860 px; Contact cards 1080 px; final CTA 600 px; flyer grid 1076 px |

### 6.2 Vertical rhythm — OBSERVED
| Token | Value |
|---|---|
| `--sec-pad` | `clamp(64px, 9vw, 110px)` |
| Generic `.sec` | `padding: calc(sec-pad/2) 0` mobile → `calc(sec-pad * .78) 0` ≥700 px (≈ 86 px at desktop) |
| Poster blocks | ink block top `clamp(76px,9vw,110px)` (110 at desktop); accent and paper blocks `clamp(56px,8vw,96px)` |
| Measured homepage | Hero 776 px (= 100svh − nav 89) · Ink block 995 · Accent block 838 · Paper action block 639 · Footer 118 |
| Heading → content | H2 margin-bottom 30–34 px in poster blocks; generic `.55em` |

### 6.3 Grids — OBSERVED
| Pattern | Columns | Gap |
|---|---|---|
| Hero (≥1000) | single column; portrait absolutely positioned | — |
| Hero (760–999) | `minmax(0,1.5fr) minmax(0,.7fr)` (≈ 68/32) | 40 px |
| Flyers | 1 col → **2 col ≥700 px** | 22 → **30 px** |
| Accent block | 1 col → `minmax(0,1fr) minmax(360px,420px)` ≥960 | 36 px row / **56 px** column |
| Action boxes | 1 col → **3 equal** ≥900 | 22 → 26 px |
| About hero | 1 col → `minmax(0,1.3fr) minmax(280px,340px)` ≥900 → `1.4fr 360px` ≥1200 | 40 → 64 px |
| About ink 2-col text | 1 → 2 ≥760 | 30 → 48 px |
| Strategy wheel | block → `0.82fr 1.18fr` ≥900 (≈ 41/59) | 52 px |
| Mandate detail | 1 → `300px 1fr` ≥880 | 30 → 52 px |
| Donate field grid | **6-column** grid; `.f` span 6 → span 3 ≥700; `.f-sm` span 2; `.f-lg` span 4 | 14 px |
| Amount tiles | 2 → 4 ≥700 | 10 px |
| Payment tiles | 3 | 10 px |
| Footer | 1 col centred → `auto 1fr auto` ≥700 | 20 px |
| Generic `.grid-2` | 1 → `1fr 1fr` ≥700 | 44 → 56 px |

### 6.4 Alignment rules (OBSERVED)
- Landing and About blocks are **left-aligned** text in the wrap. Strategy hero, Contact hero, CTA bands and the About Q&A heading are **centred**.
- Long-form reading is capped at **46–66ch** (`.sec-copy p 46ch`, hero-sub 40–56ch, mandate body 62ch, strategy intro 66ch).
- Asymmetric splits favour copy: 1.3–1.5 : 1 copy:media (About, hero mid-width); strategy 41:59 dial:panels; mandate 300 px rail : fluid body.

---

## 7. Header

### 7.1 Desktop header — OBSERVED
| Property | Value |
|---|---|
| Wrapper | `<header class="nav-wrap">`, `position: sticky; top: 0; z-index: 50; padding: 12px 16px` → total height **89 px** |
| Bar | Floating **pill**: `max-width: 1120px; border-radius: 999px; padding: 9px 12px 9px 16px`; poster: `background:#FAF4E8; border: 2px solid #28282B; box-shadow: none; backdrop-filter: none` → **1120 × 65 px** |
| Layout | `display:flex; justify-content: space-between; align-items:center` → [brand] [links] [CTA] |
| Logo treatment | Brand mark (masked SVG, accent colour) **34 × 28 px** + a 2-line **live-text lockup**: line 1 display caps 12.8 px +.06em; line 2 Plex 600 8.8 px +.26em, UPPER, `opacity:.7`, preceded by a **20 × 3 px accent dash**. Gap 11 px. The lockup is HTML text, not an image ("built live so it stays crisp on both paper and ink"). |
| Links | 5 text links, Plex Sans 600, 15.2 px, ink at `opacity:.72`; gap `clamp(9px, 2.4vw, 26px)` (≈ 26 px at desktop) |
| Hover | `opacity: 1` (and `color` stays ink); transition `color .15s ease` |
| Active | `a[aria-current="page"]` → `opacity:1` (same as hover; no underline, no pill) |
| CTA | Solid ink pill "Join"-type button: `padding: 11px 20px; font-size:.85rem` → **67 × 43 px**. Hover → accent background, ink text. Active → `scale(.97)` |
| Dropdowns | **None.** Flat navigation. |
| Sticky behaviour | Sticks at the top from the first pixel. **No background change on scroll** (no transparent→solid), no shrink, no hide-on-scroll-down. Content scrolls *under* the pill, so the cream page shows on either side of the pill above the content. |
| Height measurement | JS writes `--nav-h` / `--navh` (nav-wrap `offsetHeight`) to `:root` so the hero is exactly `100svh − nav` and sticky children park beneath the nav. |
| Entrance | While the first-visit loader is showing, `html.is-loading .nav-wrap {opacity:0; transform:translateY(-14px)}`. When the loader lifts, the nav **drops in** over `.5s` (opacity ease; transform `cubic-bezier(.22,1,.36,1)`). |

### 7.2 Corner sticker (global, OBSERVED)
A JS-injected `div.corner-badge`, `position:fixed; right:22px; top:96px; width:96px; aspect-ratio:1; z-index:70; border-radius:50%; background:#28282B; box-shadow: 4px 4px 0 #0FF0FC; pointer-events:none; aria-hidden="true"`. Inside: the mark (42% × 34%, accent) in the centre and an SVG `<textPath>` ring of uppercase text (Plex 700 12 px, +.13em, paper colour) that **rotates 360° every 26 s, linear, infinite**. At ≥1380 px it moves up to `top:16px`, sitting beside the nav pill. At ≤600 px it shrinks to **56 px** at `top:122px; right:10px`, tucked under the two-row nav. Reduced motion: rotation off.

### 7.3 Mobile header — OBSERVED from CSS (`@media (max-width:559px)`)
- **There is no hamburger menu.** The pill **wraps into two rows**: row 1 = brand + CTA, row 2 = all links spread edge to edge (`justify-content: space-between; gap:4px; padding-top:8px; border-top:1px solid rgba(40,40,43,.18)`).
- The container changes from pill to **rounded block** (`border-radius:22px; padding:10px 14px; row-gap:9px`) "so the second row doesn't look broken".
- Mark shrinks to 28 × 23 px. CTA `padding:9px 15px; font-size:.64rem` (legacy) / poster `.85rem`. Link tracking is reduced.
- The CSS comment gives the reason: shrinking type to ~8 px to fit one row was rejected as unreadable.
- Menu animation: **none** (no menu to animate).

### 7.4 Announcement bars (OBSERVED in code)
- **Site banner** (`.site-banner`): full-width accent bar **above** the nav in normal flow (so it never covers the menu), ink text 600 .92rem, centred, `padding:10px 44px 10px 16px`, × button at the right (opacity .65 → 1 on hover). Content is fetched from an endpoint, and dismissal is stored per message hash in `localStorage`.
- **Event top bar** (`townhall-pop.js`, now expired): floats **just under the nav** (top = nav bottom + 8 px, out of flow so nothing shifts), opens ~1.1 s after the hero settles, and has text + "Details" link + ×.

---

## 8. Hero (homepage `.ph`)

### 8.1 Layout — OBSERVED (measured at 1519 px)
| Element | Box | Notes |
|---|---|---|
| Section | 1519 × **776** at y 89 | `min-height: calc(100svh − var(--navh))`, `display:grid`, `overflow:clip`, `z-index:1` |
| Copy column | x 222, vertically centred (`align-self:center; padding-bottom:60px` at ≥760) | |
| H1 | 1076 × 265, top y 288 | 96 px / 0.92, three lines; longest line ≈ 600 px |
| Sub | 403 × 73 at y 577 | 28 px / 1.3, `max-width:24ch`, `margin-top:24px` |
| Portrait figure | **526 × 667**, left x 855, bottom = section bottom | ≥1000: `position:absolute; right:9vw; bottom:0; height:min(86%, 53vw); aspect-ratio: 900/1141` |
| Label sticker | 433 × 85 at (769, 755) | `position:absolute; left:-16%; bottom:6%; rotate(-4deg)`; ink bg, accent text, Plex 700 1.3rem, `padding:15px 24px; border-radius:12px; box-shadow: 6px 6px 0 #0FF0FC`; mark icon 28 × 23 inside |
| Background mark | 839 × 717 | `left:50%; top:4%; width:min(78vw,760px); transform: translate(-42%, var(--drift)) rotate(-8deg); background:#28282B; opacity:.045` (mask = brand mark) |
| Scroll cue | 2 × 34 px at bottom centre (y 813) | ink line at 50% opacity; an accent segment runs top → bottom inside it every **1.6 s** (`cubic-bezier(.6,0,.4,1)`, infinite) |

**Proportions:** copy occupies the left **~55%** of the wrap; the portrait occupies the right **~35–40%** of the viewport and bleeds to the section's bottom edge. **No CTA buttons in the hero.** The only action above the fold is the nav CTA. The hero is purely statement + face.

### 8.2 Image treatment
- A **background-removed cut-out** (transparent WebP, preloaded: `<link rel="preload" as="image" … .webp>`). There's nothing behind it: no frame, no shape, no shadow. It "stands on the bottom edge of the page".
- It's cropped only by the section's bottom edge (waist/forearms). `aspect-ratio: 900/1141` (≈ 0.79, portrait).
- The next section (ink block) has `position:relative; z-index:2`, so on scroll **the portrait slides down behind the ink block's top edge** (with parallax).

### 8.3 Entrance timeline — OBSERVED (CSS keyframes + frame captures after clearing the session flag)

First visit per browser session only (a `sessionStorage` flag). Later page loads skip the loader and start the reveals immediately.

| t (approx.) | Event | Spec |
|---|---|---|
| 0 ms | Loader overlay | `position:fixed; inset:0; z-index:200`, page-colour background, the mark (46 × 38) **pulsing** opacity 1 → .55 (1.2 s loop), a 240 × 2 px track whose ink fill slides in `translateX(-100%→0)` over **1.7 s** `cubic-bezier(.6,0,.2,1)`. Page scroll is locked (`html.is-loading {overflow:hidden}`). |
| `window.load` + 400 ms (failsafe 2600 ms) | Loader fades out | `opacity/visibility .55s ease`. Nav drops in (.5 s). Background mark and scroll cue are visible on their own ("background breathes alone"). |
| +550 ms after fade starts = **T0** | Reveals start | `.in` added via IntersectionObserver |
| T0 + 0 ms | Ribbon line 1 | Accent bar behind the line: `scaleX(0→1)` from the left over 0–46% of **1.5 s**, holds, then `scaleX(1→0)` toward the **right** (origin flips) by 100%. `cubic-bezier(.3,1,.4,1)` |
| T0 + 160 ms | Ribbon line 2 bar | same |
| T0 + 220 ms | Line 1 text | `clip-path: inset(-12% 100% -12% 0) → inset(-12% -4% -12% 0)` over **0.7 s** `cubic-bezier(.22,1,.36,1)`: text is "printed" left→right behind the bar |
| T0 + 320 ms | Ribbon line 3 bar | same |
| T0 + 380 ms | Line 2 text | same unveil |
| T0 + 540 ms | Line 3 text | same unveil |
| T0 + 550 ms | Portrait | `pop`: `opacity 0, translateY(40px) → none`, **1.1 s** `cubic-bezier(.22,1,.36,1)` |
| T0 + 1000 ms | Sub-headline | `rise`: `opacity 0, translateY(14px) → none`, **0.8 s** |
| ≈ T0 + 2050 ms | Settled | Ribbon bars have fully retracted; only the ink text remains |

Frame captures confirmed it: (1) loader only, (2) nav + faint mark + cue, (3) cyan bars mid-sweep with half-revealed letters, (4) bars retracting with the portrait risen, (5) final state.

*Unused legacy hero entrance (main.css): `settleL / settleR`, elements slide in from ±110 px with a wobble (`rotate ±2.4° → ∓1.2° → ±0.6° → 0`), 1.3 s, staggered 0.16/0.3/0.42/0.52 s. Not on current pages.*

### 8.4 Scroll behaviour — OBSERVED (`main.js`)
Elements with `data-parallax="k"` get `--drift = min(scrollY, 1.2 × innerHeight) × k`, applied as `translateY(var(--drift))` (rAF-throttled, passive listener):

| Layer | k | Effect at 500 px scroll |
|---|---|---|
| Background mark | **0.22** | moves down 110 px (slowest, so it reads as "furthest") |
| Portrait | **0.18** | moves down 90 px, sinking behind the next block |
| Copy | **0.08** | moves down 40 px |

Because each layer moves *down* at a different fraction of the scroll, the page scrolls up past them at different speeds. That gives three depth planes. Disabled under reduced motion.

### 8.5 Responsive hero — OBSERVED from CSS
| Width | Layout |
|---|---|
| < 760 | Single column, copy on top, portrait below (`width:min(84%,320px)`, centred), label sticker `left:-6%` 0.95rem; ≤420 px sticker 0.82rem `left:-2%` |
| 760–999 | 2 columns `1.5fr / .7fr`; portrait `width:min(100%,400px)` right-aligned; label `left:-14%` |
| ≥ 1000 | Single column copy; portrait absolute, right `9vw`, height `min(86%,53vw)`; H1 drops to `clamp(2.8rem,6.6vw,6rem)` |

---

## 9. Section Patterns (catalog)

Each pattern below is named generically for reuse.

### 9.1 `PosterHero` (paper, full screen)
Covered in §8. **Purpose:** single statement + face. **Reusable rules:** `min-height: 100svh − nav`; 3-line ribbon headline; one sub line; one cut-out image anchored to the bottom edge; faint giant mark; scroll cue; no buttons.

### 9.2 `SplitHeroWithMedia` (About)
- **Structure:** eyebrow (mark + bold sentence) → H1 (3 short lines, 0.9 lh) → 2 paragraphs (second muted) → row of "jump" sticker pills; right column: a tilted video "phone".
- **Layout:** `1.4fr / 360px` at ≥1200, gap 64; min-height = viewport minus nav.
- **Media:** 9:16 frame, `border-radius:28px; border:3px solid ink; box-shadow:8px 8px 0 accent; rotate(-2.5deg)`; play button = 84 px accent disc with `4px 4px 0 ink` shadow and an ink triangle; Instagram-style handle chip top-left (paper pill, 2 px ink border, 3 px accent shadow).
- **Mobile (<900):** the copy wrapper becomes `display:contents` and children are re-ordered: kicker → H1 → **video** → text → pills (the video moves up to sit right under the name).
- **Animation:** phone reveals 0.9 s with 0.4 s delay (`translateY(40px) rotate(tilt) → rotate(tilt)`); the copy has parallax drift; **the video is deliberately not parallaxed** (comment in source).

### 9.3 `CenteredPageHero` (Strategy, Donate, Contact)
Eyebrow (bold sentence) → H1 with **highlighted final word** → muted paragraph (`max-width:52–66ch`). Centred for Strategy and Contact, left-aligned for Donate. Padding ~80/60 px at desktop (`.hero` ≥700). Contact adds the mark as a 64 × 52 logo above (38 × 31 when it compacts to fit one screen).

### 9.4 `InkBlockFlyerGrid` (homepage "four items")
- **Purpose:** present 4 key pillars as pinned paper flyers.
- **Structure:** ink full-bleed block → 2 × 2 grid of `<article>` flyers → centred accent CTA pill → **marquee strip** along the bottom edge of the block.
- **Flyer:** see Card A (§10).
- **CTA:** accent background, ink text, **larger** than standard (`padding:16px 32px; font-size:1.05rem` → 255 × 58 px); hover → paper background.
- **Animation:** flyers rise 28 px with their tilt, staggered 0 / 0.1 / 0.2 / 0.3 s; CTA delayed 0.3 s.

### 9.5 `Marquee` (logo strip)
`overflow:hidden; margin-top: clamp(56px,7vw,88px); padding:18px 0 22px`. The track holds **two identical sets** and animates `translateX(0 → -50%)` over **38 s linear infinite**. Items: display caps `clamp(1.1rem,2.2vw,1.5rem)` in the accent colour, separated by paper-colour mark icons (26 × 21), gap 34 px. Not interactive and doesn't pause on hover. Static under reduced motion.

### 9.6 `AccentBlockStatementForm` (homepage cyan block)
- **Structure:** left column = huge ink H2 (max 16ch) → 2 large statement sentences (one with an **inline ink stamp number**) → compact 2-column form (4 fields + button) → fineprint. Right column = **paper instruction card** with an ink offset shadow, numbered steps and a mono source line.
- **Layout:** `minmax(0,1fr) minmax(360px,420px)`, column gap 56; the card stretches to match the left column's height, and its steps use `align-content: space-evenly`.
- **Decor:** giant mark at ink 9%, right −8%, rotate 8°.
- **Steps list:** custom counters: a 30 × 30 ink rounded square (radius 8), accent display numeral, rotated −3°. Bold lead-in + muted text. Links: ink, `text-decoration-color: accent; thickness: 3px; underline-offset: 3px`; hover → accent background, no underline.

### 9.7 `BillboardActionRow` (homepage closing)
- **Structure:** 2-line ribbon headline at billboard size → 3 equal boxes.
- **Boxes:** radius 18, padding `30px 28px 34px`. (1) **accent** box + ink shadow: a list of icon-disc link rows; (2) **ink** box + accent shadow: outline-paper button + accent solid button; (3) **paper** box with 2 px ink border + accent shadow: a single ink button.
- **Corner sticker on every box:** the brand mark (`clamp(64px,24%,96px)`, rotate −8°) printed twice, offset 6 px, in the box's opposite colours: a "misregistered screen print".
- **Animation:** boxes rise 28 px staggered 0 / 0.1 / 0.2 s.

### 9.8 `InkStoryTwoColumn` (About "Who I am")
Mono chapter kicker "01 / 04" in accent with a paper mark → H2 with the second word highlighted → display-caps pull quote with a highlighted phrase → 2 columns of 1.05–1.2 rem paragraphs at 82% paper opacity (second column reveals 0.12 s later; each column topped by a small mark) → marquee.

### 9.9 `ChatThreadQA` (About "Direct answers", accent block)
- Centred kicker + H2 (max 16ch). Thread `max-width:860px`, gap 22.
- **Question bubble:** paper, left-aligned, `border-radius: 22px 22px 22px 6px` (tail = square-ish bottom-left), display caps `clamp(1.1rem,2vw,1.4rem)`, right padding 26% at ≥700 px.
- **Answer bubble:** ink, right-aligned, `border-radius: 22px 22px 6px 22px`, 80%-paper text, the first line bold paper; a mono name tag with a mark above it, right-aligned.
- **Embedded stat card** in an answer: paper, 2 px ink border, mono heading with mark, **4 stats** (2 cols → 4 cols ≥700) with display numbers on accent boxes (count-up) and small muted labels.
- **Motion:** questions slide in from −22 px X, answers from +22 px X (0.18 s later).

### 9.10 `FlyerLinkGrid` (About "What we're fighting for")
Same as 9.4, but on **paper**, with the cards as **links** (2 px ink border) and an **arrow stamp** (36 px ink disc, accent arrow, rotate −3°) in the top-right corner. Ribbon heading. Centred ink CTA below.

### 9.11 `InkClosingWithTicket` (About closing)
- Left: H2 (max 10ch, last word highlighted) → lede with a **4 px accent left rule** → 3 **action rows** → muted closing note.
- **Action row:** grid `52px 1fr 30px`, `padding:12px 14px 12px 12px; border-radius:18px; background: rgba(paper,.05); border: 2px solid rgba(paper,.2)`; 52 px icon disc (variants: accent fill / paper fill / outline), display-caps label + small caption, 30 px paper arrow disc.
- Right: **ticket card**: paper, `rotate(1.6deg)`, `8px 8px 0 accent`, header with double-printed mark, 2 date rows (huge display numerals; one on an accent box rotated −2°) divided by a **2 px dashed** line, footer with a 2 px solid top rule.
- Faint paper mark at 5% bottom-left.

### 9.12 `StickyDialScrollytelling` (Strategy hub): see §15.

### 9.13 `DetailWithStickyRail` (mandate page)
- Breadcrumb eyebrow ("Section / Item 01 of 06", the section link underlines on hover) → H1 → one-line lede.
- Grid `300px | 1fr`, gap 52; **left rail `position:sticky; top:92px`** with stacked **stat cards** (see Card F); right body: H2 "problem" + 1.08 rem lead, H2 "plan" + numbered list.
- **Numbered plan list:** CSS counter `decimal-leading-zero` in a 36 × 36, radius-10 square (1.5 px accent-tinted border, 5% accent fill, mono 600 .78 rem), item `padding-left:52px; max-width:62ch`; title Plex 700 1.02 rem (sentence case: the one place H3 isn't caps); body muted .98 rem / 1.7.
- **Pager:** 3 columns `1fr auto 1fr`: prev card (mono "← ITEM 03" + title), centred mono "ALL SIX" text link, next card right-aligned ("ITEM 02 →"). Cards have a 14 px radius, paper-field background and ink border; hover → accent border + tint.
- **CTA band:** centred H2 question + two buttons (solid + outline).

### 9.14 `NumberedStepForm` (Donate): see §17/§18.

### 9.15 `SingleScreenContact` (Contact; screenshotted, document height = viewport height)
At ≥760 px, `body.contact-page` is a full-height flex column (`min-height:100dvh`); `main` flex-grows and centres hero + 3 cards + closing line with `gap: clamp(14px,3vh,36px)`. All spacing is vh-clamped so it fits any monitor height without scrolling; shorter windows scroll instead of clipping (`flex: 1 0 auto`). Cards: 1 col (max 460) → 3 col ≥860 (max 1080, gap 22).

### 9.16 `FunnelPage` (Join; screenshotted mid-entrance and settled)
No nav, no WhatsApp pop, no banner. Width 560. Mark (link home) stamps in → eyebrow rises → headline words rise one by one (70 ms stagger) → highlighted word's background grows left→right, then the word "kicks" (scale 1.08, rotate −2°) → aside note (2 px accent left rule) → form card unfolds → fields deal in → submit button with a looping sheen. Exit buttons sit **after** the form "so they never compete with the submit button".

### 9.17 `CTABand`
Centred H2 question + a row of 2 pill buttons (`gap:12px; flex-wrap`). Used at the end of strategy/mandate pages.

### 9.18 Legacy patterns present in CSS but not seen on current routes (OBSERVED in source only)
Reel carousel (9:15.5 phone frames, swipe + dots + floating comment bubbles), Q&A card deck (stacked tilted cards, out up-left / in from below), testimonial quotes with verified tick, "receipt" card (mono, zig-zag torn bottom edge built from two `linear-gradient` triangles, rotate −1.4° → 0 on hover), countdown grid (days/hours/mins/secs tiles), two-way join (email OR WhatsApp with an "or" hairline divider). Worth knowing as ready-made concepts (Stories, Impact counters).

---

## 10. Card System

All values OBSERVED (poster layer unless noted). Every card has its own style: they are **not all the same**.

| ID | Card | Size (desktop) | Surface / border / radius | Shadow | Content | Hover / cursor | Transition |
|---|---|---|---|---|---|---|---|
| **A** | **Flyer** (homepage pillars, `<article>`, not a link) | 529 × 312 (2-col of 1076) | `#FAF4E8`, no border on ink block, radius 16, padding `32px 34px 36px` | `6px 6px 0 #0FF0FC` | Double-printed mark 46 × 37 → H2 33.6 px → muted p 16.8 px (max 40ch); gap 12 | **Tilt removed + lift**: `rotate(0) translateY(-5px)`, shadow → `10px 10px 0`. Cursor default | `.3s` with the 0.7 s ease-out curve; reveal transitions `opacity/transform .7s cubic-bezier(.22,1,.36,1)` |
| **A′** | **Flyer link** (About) | same | + `2px solid #28282B` border | same | + 36 px arrow stamp top-right | Same lift; arrow stamp turns accent, rotates to 0, shifts +3 px X, gains an inset 2 px ink ring | 0.2 s |
| **B** | **Action box** (3-up) | 341 × 257 | accent / ink / paper(+2 px ink border); radius 18; padding `30px 28px 34px` | `6px 6px 0` ink or accent (opposite colour) | Corner double-printed mark; H3; links or buttons | Box itself static. Link rows `translateX(6px)` | .15 s |
| **C** | **Step card** (Donate, Volunteer, Join form) | max 760 wide | paper, 2 px ink, radius 18, padding `30px` (≥700) / `26px 22px` | `5px 5px 0 accent` | Numbered circle (34 px, accent fill + ink border) + H2 1.15 rem; note; fields | — | Unfold on reveal |
| **D** | **Strategy panel** | ≈ 620 wide × long | paper, 2 px ink, radius 18, padding `30px 28px` | `5px 5px 0 accent` | Mono "ITEM 0X" → H3 → lede → stat row between hairlines → rules list | Not hoverable; **focus state driven by scroll** (§15). Current panel: border turns accent-tinted `rgba(15,240,252,.42)` and the hard shadow becomes a soft `0 26px 60px rgba(0,0,0,.45)` + `0 0 40px` accent glow (the legacy rule wins on specificity, OBSERVED in screenshots) | opacity/filter/border .45 s; transform .5 s `cubic-bezier(.22,1,.36,1)` |
| **E** | **Instruction / ticket card** | 420 × 646 (steps), ≤440 (ticket) | paper, radius 16–18, padding 30 / `26px 28px 24px` | `8px 8px 0` **ink** (on accent) or **accent** (on ink) | Header with mark; numbered steps or date rows | Ticket tilted 1.6°; no hover | Reveal .7–.8 s |
| **F** | **Stat card** (mandate rail) | 300 wide | paper, 2 px ink, radius 18, padding `22px 22px 18px` | `5px 5px 0 accent` | Big display number on accent box (`clamp(2rem,6vw,2.8rem)`), unit at .45em, label .85–.9 rem muted, mono "SOURCE" link | — | — |
| **G** | **Contact card** (screenshotted) | 1/3 of 1080, equal heights | as Card C + `card-head` with 38 px icon tile (2 px ink border, accent fill, radius 10; WhatsApp variant tinted green) | `5px 5px 0 accent` | Icon + title (display caps, 1 rem) + mono handle → muted text (.85 rem) → **full-width outline button pinned to the bottom** (channel button green-outlined) | `translate(-2px,-2px)`, shadow → `7px 7px 0` | .25 s |
| **H** | **Pager card** | ~ 1/2 of 1076 | paper-field, 1 px → poster ink border, radius 14, padding `16px 18px` | none | Mono direction label (accent→ink on poster) + title 600 .92 rem | border → accent, bg → 6% accent | .2 s |
| **I** | **Chat bubbles** | ≤ 74–88% of 860 | paper / ink, asymmetric radius (22/22/22/6) | none | Display-caps question / body answer | — | Reveal from the sides |
| **J** | **Amount / payment tile** | 1/4 or 1/3 of 700 | paper-field, 2 px ink, radius 14 | none | Amount 800 1.05 rem + mono caption / icon + caption | border → 50% accent | .15 s; selected = accent fill |
| **K** | **Checkbox card** | full width | paper-field, ink border, radius 14, padding `14px 16px` | none | 22 px custom box + .85 rem text | — | checked box: accent fill + ink tick |
| **L** | **WhatsApp pop** | 320 wide | paper, 2 px ink, radius 14 (18 legacy) | `5px 5px 0 accent` | icon disc + title + × / text / full-width green-outline button | — | slide in .5 s |

**Reusable card primitives:** (1) *paper + 2 px ink + accent offset shadow* (Card C/D/F/G/L): the default container; (2) *tilted flyer* (A/A′/E): emphasis items; (3) *colour-block box* (B): grouped actions; (4) *field tile* (J/K/H): selectable and nav surfaces, no shadow.

**Not present:** image-led cards (no thumbnails, no image hover zoom), gradient overlays, card carousels on live pages.

---

## 11. Image System — OBSERVED

| Use | Format | Ratio | Treatment |
|---|---|---|---|
| Hero portrait | WebP, preloaded, transparent background (cut-out) | 900 : 1141 | No frame; anchored to the bottom edge; parallax 0.18; slides behind the next block; label sticker overlaps it |
| About video | `<video>` (format UNKNOWN) | 9 : 16 | "Phone" frame: radius 28, 3 px ink border, 8 px accent offset, tilt −2.5°; `object-fit: contain` (letterboxed, never cropped); muted hover preview on desktop; play-with-sound on click; pauses when scrolled out of view (IO threshold 0.2); fullscreen uses `contain` |
| Brand mark | `mark.svg` used as a **CSS mask** on coloured boxes (`mask: url(mark.svg) center/contain no-repeat`) | 219 : 178 | Recoloured freely by `background` |
| Texture | `grain.svg` | tile 150–180 px | Page overlay (multiply, .32) and the text-fill grain |
| Lines | `bg-lines.svg` | tile 900 / 1500 px | Legacy dark theme only |

**Conclusion:** images are **content anchors, used sparingly**: one person cut-out and one video. Everything else that looks "graphic" is typography, flat colour and the masked mark. No photo grids, no image cards, no image hover scaling, no clip-path reveals on photos, no rounded photo crops apart from the phone frame.

---

## 12. Icon System — OBSERVED

- **Type:** inline **SVG** (hand-authored paths, no icon font, no library detected). Social/channel icons, form-field icons, payment icons, card icons and action icons are all inline `<svg>` with `fill:none; stroke:currentColor; stroke-linecap:round; stroke-linejoin:round`.
- **Stroke widths:** 1.6–1.9 (cards 1.8, payment/field 1.7, WhatsApp 1.6, action rows 1.9).
- **Sizes:** 15 px (chips), 16 px (footer social), 17 px (field icons, at 15 px left inset), 19–22 px (buttons, tiles), 24 px (action rows).
- **Containers:** icons nearly always sit in a **container shape**: 42 px circle (link rows, ink disc + accent icon), 38 px circle (footer social, 1 px border), 42 × 42 radius-12 tile (cards), 52 px disc (About action rows), 36 px disc (arrow stamps).
- **Arrows:** text glyphs (→, ←) inside discs, not SVG; mono labels use "← " / " →".
- **The brand mark as an icon:** list bullets in eyebrows/kickers (18–26 px), "double print" (two masked layers, the back layer offset 4–6 px in the second colour), the centre of the rotating badge, the loader, the strategy dial hub.
- **Animated icons:** loader mark pulse; rotating badge; join-page mark "stamp" (`scale(.3) rotate(-25deg) → none`, 0.75 s, overshoot `cubic-bezier(.34,1.56,.64,1)`). No hover animation on icons themselves, except the containing link moving and the arrow stamp shifting.

---

## 13. Button System — OBSERVED

Base `.btn`: `display:inline-block; border-radius:999px; border:0; cursor:pointer; text-align:center; text-decoration:none; transition: transform .15s ease, box-shadow .15s ease, color .15s ease;` **`:active { transform: scale(.97) }`**. Poster override: **Plex Sans 700, .95 rem (15.2 px), letter-spacing 0, sentence case, `padding:14px 26px`** → ~52 px tall.

| Variant | Default | Hover | Notes / where |
|---|---|---|---|
| **Solid (primary)** `.btn-solid` | bg ink `#28282B`, text paper | bg **accent**, text ink (instant colour swap, no shadow) | Default primary on paper |
| **Solid on ink/accent blocks** | bg **accent**, text ink | bg **paper**, text ink | Overridden per block "or the generic cyan hover wins and the button vanishes into the block" |
| **Large CTA** | as above, `padding:16px 32px; font-size:1.05rem` | — | Section closer (255 × 58 px) |
| **Outline** `.btn-line` | transparent, ink text, `inset 0 0 0 2px ink` | **fills ink**, text paper | Secondary |
| **Outline on ink** | paper text, `inset 0 0 0 2px paper` | fills paper, text ink | Inside the ink action box |
| **Channel (WhatsApp)** `.btn-wa` | transparent, `inset 0 0 0 2px #1FAE54`, icon green | bg `#1FAE54`, text white | Flex with 9 px gap, full width |
| **Nav CTA** | solid ink, `padding:11px 20px; .85rem` → 67 × 43 | accent | — |
| **Full-width submit** | `width:100%; padding:16–17px` | — | `:disabled {opacity:.4; cursor:not-allowed}`; Join adds a looping **sheen** (`::after` 30%-wide skewed accent gradient sweeping across every 4.5 s after a 2.2 s delay; stops on hover) |
| **Icon round** (legacy carousel) | 44 × 44 circle, 1.5 px accent border | 8% accent fill | — |
| **Sticker pill** (About jump links, chip on video) | paper, 2 px ink, `3px 3px 0 accent`, Plex 700 .85 rem, leaf icon | `translate(-2px,-2px)`, shadow 5 px, bg accent, icon → ink | .15 s |
| **Disabled look** `.btn-off` | `opacity:.45; cursor:not-allowed` | — | — |

**Focus:** `:focus-visible { outline: 3px solid #28282B; outline-offset: 3px }` on poster pages (legacy: 2 px cyan). Hidden-input tiles use `:has(input:focus-visible)` to show the ring on the visible tile.
**Common system:** one pill geometry, two fills (ink/accent) that **swap on hover**, one outline that **fills on hover**, and every colour pairing chosen per surface so the hover state never matches the background. No icons inside primary buttons except channel buttons. No arrow animation on buttons.

---

## 14. Motion System — OBSERVED unless marked

**Implementation:** pure CSS transitions/keyframes + a small vanilla JS file. **No animation library** (no GSAP, Lenis, AOS, Framer, Swiper: confirmed by the absence of globals and scripts). Native `scroll-behavior:smooth` on `html` (off under reduced motion). JS adds `.in` via **IntersectionObserver (threshold 0.12, unobserve after first hit)**.

**Easing vocabulary (verbatim curves):**
| Name (mine) | Curve | Used for |
|---|---|---|
| ease-out-expo-ish | `cubic-bezier(.22,1,.36,1)` | Reveals, card transitions, nav drop, pop, rise, WhatsApp slide |
| soft-out | `cubic-bezier(.33,1,.4,1)` | Carousels, legacy settle, Q&A deck |
| print-sweep | `cubic-bezier(.3,1,.4,1)` | Ribbon wipe, highlight grow |
| loader | `cubic-bezier(.6,0,.2,1)` | Loader fill |
| spring overshoot | `cubic-bezier(.34,1.24,.5,1)` | Strategy dial marker |
| stamp overshoot | `cubic-bezier(.34,1.56,.64,1)` | Stamps (mark, step numbers) |
| unfold | `cubic-bezier(.7,0,.2,1)` | Form card unfold |
| cue | `cubic-bezier(.6,0,.4,1)` | Scroll cue tick |

**Catalogue**

| # | Category | Trigger | Element | Initial → final | Duration / delay / stagger | Easing | Reduced motion |
|---|---|---|---|---|---|---|---|
| A | Page entrance (loader) | First visit per session | Full-screen overlay | visible → `opacity 0; visibility hidden` | fill 1.7 s; fade .55 s at load+400 ms (max 2.6 s) | loader / ease | Loader removed instantly |
| A2 | Nav entrance | Loader lift | `.nav-wrap` | `opacity 0, translateY(-14px)` → none | .5 s | ease / ease-out-expo | No transition |
| B | Hero entrance | Reveal start | Ribbon lines, portrait, sub | §8.3 | 0–2.05 s total | print-sweep / expo | Bars hidden, no clip, no animations |
| C | Text reveal (ribbon) | `.in` on `.ribbon-h` | Accent bar + text | bar `scaleX 0→1→0` (origin left→right); text `clip-path inset(…100%…) → inset(…-4%…)` | bar 1.5 s; text .7 s at +.22 s; lines +.16 s each | print-sweep / expo | Static text |
| C2 | Word-by-word (Join) | Load | `.jn-w` words | `opacity 0, translateY(.55em) rotate(3deg)` → none | .7 s; `0.3s + i × 0.07s` | expo | (inherits global reduce: reveal disabled) |
| C3 | Highlight grow | Load | `.glow` on Join H1 | `background-size 0% 100% → 100% 100%`, then a kick `scale(1.08) rotate(-2deg)` | .55 s at .95 s; kick .4 s at 1.4 s | print-sweep / ease-out | — |
| C4 | Marker underline | Load | `.jn-hl` | `background-size 0% 45% → 100% 45%` (lower-half highlighter) | .6 s at 1.45 s | print-sweep | — |
| D | Image reveal | `.in` | Portrait / video phone | `opacity 0, translateY(40px)` (+ tilt kept) → none | 1.1 s @ .55 s / .9 s @ .4 s | expo | Static |
| E | Scroll reveal (generic) | IO 12% | `.reveal` | `opacity 0, translateY(26px)` → none | .7 s | expo | `opacity 1; transform none` |
| E2 | Directional reveal | IO | `.reveal-l/-r`, chat bubbles | `translateX(±52px)` (generic) / `±22px` (bubbles) → none | .7 s; answers +.18 s | expo | Static |
| E3 | Flyer reveal | IO | `.pp-item`, `.af-item`, `.pa-box`, ticket | `opacity 0, translateY(28–30px) rotate(tilt)` → `rotate(tilt)` | .7–.8 s; 0 / .1 / .2 / .3 s | expo | Static, tilt kept |
| E4 | Form unfold | IO | `.unfold` cards | `clip-path: inset(0 50% calc(100% - 3px) 50%)` (a 3 px line at the centre) → `inset(0 -12px calc(100% - 3px) -12px)` at 38% (line spans full width) → `inset(-12px)` (card drops open downward); children `rise` (.55 s) at `d + .6s + k×.08s`; checkbox rows at `d + .85s + c×.07s`; step number **stamps** at `d + .7s` | .95 s; `--d` .1 s default, .35 s first donate step, .75 s join | unfold / expo / stamp | (global reduce: visible) |
| F | Parallax | Scroll (rAF) | `[data-parallax]` hero layers; legacy `[data-depth]` | `translateY(min(scrollY, 1.2vh) × k)` with k = .22 / .18 / .08 | continuous | linear | Off |
| G | Card hover | Hover | Flyers | tilt → 0, `translateY(-5px)`, shadow 6 → 10 px | .3 s (delay reset to 0) | expo | Hover lift disabled for `.card`; flyers keep tilt |
| G2 | Card hover (generic) | Hover | `.card` | `translate(-2px,-2px)`, shadow 5 → 7 px | .25 s | ease | `transform:none` |
| H | Button hover | Hover / active | `.btn` | colour swap; active `scale(.97)` | .15 s | ease | — |
| H2 | Row hover | Hover | Link rows, action rows | `translateX(6px)`; arrow disc +3 px and → accent | .15 s | ease | Off for link rows |
| I | Navigation | Loader lift / hover | Nav links | opacity .72 → 1 | .15 s | ease | — |
| J | Menu animation | — | — | **None** (no menu) | — | — | — |
| K | Number counter | IO 50% | `[data-countup]` | 0 → target, `toLocaleString()` separators | **1400 ms**, ease-out cubic `1-(1-p)^3` | JS | Final number shown immediately |
| K2 | Live countdown | Load | `[data-countdown-to]` | ticks every 1 s; optional "calendar days" mode (timezone-aware) | — | — | — |
| L | Sticky / pinned | Scroll | Strategy dial, mandate stat rail | CSS `position:sticky` (no scroll-jacking) | — | — | Still sticky |
| L2 | Scroll-linked focus | Scroll (rAF) | Strategy panels | inactive: `blur(2.5px) scale(.975) translateY(8px)` (opacity .17 on legacy; **stays 1 on poster**, OBSERVED); active: none + highlighted border | .45–.5 s | expo | Opacity .45, no blur, no movement |
| L3 | Dial marker | Section change | Accent wedge | `rotate(i × 60deg)`, **shortest path** (never unwinds 300°) | .62 s | spring overshoot | No transition |
| L4 | Progress ring | Scroll | SVG circle | `stroke-dashoffset: 1 − p` (p = reading line through the deck, 0–1) | continuous | — | — |
| L5 | Label swap | Section change | Dial hub / bar label | opacity → 0, text swapped at 200 ms, → 1 | .22 s | ease | — |
| M | Horizontal scroll | — | Marquee only (auto) | `translateX(0 → -50%)` | 38 s linear ∞ | linear | Static |
| N | Modal | — | — | **No modals on the site** | — | — | — |
| N2 | Slide-in prompt | 9 s after load OR scroll > 0.9 vh | WhatsApp pop | `translateY(160%), opacity 0` → `0, 1` | .5 s | expo | Opacity only |
| O | Form feedback | Submit / invalid | Fields | red border + 3 px red halo (`aria-invalid="true"`), focus moved to the field; success = page reload with `?flag` → toast | instant | — | — |
| P | CTA animation | Idle | Join submit | Sheen sweep across the button | 4.5 s loop, 2.2 s delay | ease-in-out | (stops on hover) |
| Q | Ambient | Always | Corner badge text ring | `rotate(360deg)` | 26 s linear ∞ | linear | Off |
| Q2 | Ambient | Always | Scroll cue | accent segment falls through the line | 1.6 s ∞ | cue | Off |
| Q3 | Ambient (legacy) | Always | Mark drift 70 s; line drift 90/130 s; glows 17/23/28 s; float 7–13 s on decorative elements; proof dot pulse 2.4 s | — | ease-in-out alternate | Off |

**Motion principles to carry over:** (1) a single "print pass" signature move (wipe-and-reveal) instead of many effect types; (2) reveals are short travels (22–52 px) with an expo-out curve and ≤0.3 s staggers; (3) objects keep their tilt through the reveal and lose it only on hover, so "reaching for" a card straightens it; (4) continuous ambient motion is limited to the badge, the marquee and the cue; (5) every motion has a reduced-motion branch, and the structural ones (dimming in the wheel) are kept but simplified.

---

## 15. Scroll Storytelling

### 15.1 Strategy hub "wheel": exact visitor experience (OBSERVED: screenshots + `main.js`)

**Desktop (≥900 px):**
1. Below the centred hero, the section is a two-column grid (`0.82fr | 1.18fr`, gap 52). The left column holds an **SVG dial** (max 360 px): a dark ring of **6 wedges** numbered 01–06 (mono 15 px accent numerals), a dark hub disc containing the brand mark and a **mono label naming the current item**, an **outer progress ring** (3 px), and a mono hint below ("keep scrolling — or tap a segment" pattern).
2. The dial is `position: sticky`, **vertically centred in the space under the nav**: `top: max(nav + 20px, nav + (100vh − nav − dialHeight)/2)`. It stays level with the text while the right column scrolls.
3. The right column is **six ordinary panels in normal flow** (no scroll-jacking; the page scrolls natively).
4. A **reading line** sits at **46% of viewport height**. On every scroll frame, the panel crossing that line (or the panel whose centre is nearest, in gaps) becomes "current":
   - the **accent marker wedge rotates** to that segment over .62 s with a slight spring overshoot, taking the shortest direction;
   - that segment's numeral flips to ink (on the accent wedge);
   - the hub label **cross-fades** (out .22 s, swap at 200 ms, in);
   - the current panel is sharp, with a highlighted border/shadow; **all other panels are blurred 2.5 px, scaled .975 and pushed down 8 px** (on the poster theme they keep full opacity, so they read as "out of focus" rather than faded: OBSERVED in screenshots).
5. The **outer ring fills continuously** from 0 → 100% as the reading line travels through the panel deck (`--wh-p`), which gives a smooth progress readout under the stepped marker.
6. **Clicking a wedge** smooth-scrolls to that panel (`scrollIntoView({block:'start'})`, with `scroll-margin-top` clearing the nav). Wedge hover = 10% accent fill.
7. Webfont load, resize, orientation change and tab visibility all trigger a re-measure, so the dial never reads stale.

**Mobile/tablet (<900 px):**
- The dial becomes a **compact sticky pill bar** parked under the nav (`top: nav + 8px`): a small dial (58–78 px, numerals hidden, not tappable because the wedges would be ~24 px targets) + a read-out "0X / 06" (mono, current number in accent) + the item label in display caps. The bar has its own glass/ink styling (transparent on poster).
- The reading line is just under the sticky bar (26% of the remaining height).
- On short landscape screens (`max-height:520px`) the bar drops out of sticky so it doesn't eat the screen.
- With JS off, all panels render plainly as a stacked list (progressive enhancement is stated in the CSS).

### 15.2 Mandate page sticky rail
On ≥880 px the stat column is `position: sticky; top: 92px`, so stats stay visible beside the long-form plan as you read. The section's bottom padding is reduced (×.55) so the shorter sticky column doesn't leave a hole above the pager.

### 15.3 Homepage
- Three-plane parallax in the hero (§8.4), and the portrait sinks behind the ink block (z-index layering).
- Reveals per block. No pinning, no horizontal scroll, no colour change, no progress indicator on the homepage.
- The marquee runs continuously regardless of scroll.

### 15.4 Not present (do not invent)
No scroll-snap, no pinned full-screen scenes, no horizontal scroll sections, no scroll-linked background colour changes, no active-section nav indicator, no reading progress bar.

---

## 16. Interaction System (component × input) — OBSERVED unless marked

| Component | Hover | Click / tap | Focus (keyboard) | Scroll | Drag / touch | Keyboard |
|---|---|---|---|---|---|---|
| Nav link | opacity .72 → 1 | navigate | 3 px ink outline, offset 3 | sticky | — | Tab order: skip link → brand → links → CTA |
| Primary button | ink ↔ accent swap | `scale(.97)` press | outline ring | — | — | Enter/Space native |
| Flyer card (article) | straighten + lift 5 px + shadow 10 px; cursor default | none (not a link on home) | — | reveal | — | — |
| Flyer link (About) | as above + arrow stamp nudges right, turns accent | navigate | ring | reveal | — | — |
| Link row (socials) | row slides 6 px right | open channel | ring | — | — | — |
| Action row (About) | slides 6 px, border → accent, bg 8% accent, arrow disc → accent +3 px | navigate / share | **same as hover** (`:focus-visible` mirrors hover, outline none) | — | — | — |
| Share action | — | `navigator.share()` (native sheet) else opens wa.me with prefilled text | ring | — | — | — |
| Sticker pill | lift −2/−2, shadow 5 px, bg accent | jump to section anchor (smooth) | ring | — | — | — |
| Video phone | **desktop: muted autoplay preview while hovered; reset on leave** | play from 0 with sound, native controls appear, play button hidden | play button `:focus-visible` scales 1.07 | pauses when <20% visible | — | native video keys |
| Strategy wedge | 10% accent fill | smooth-scroll to panel | (SVG hit areas; keyboard support UNKNOWN) | drives state | — | UNKNOWN |
| Amount tile | border 50% accent | select → accent fill (`.is-on`) | ring | — | — | UNKNOWN (button vs radio) |
| Payment tile | — | hidden radio fills the tile; selected = accent | `:has(input:focus-visible)` ring on the tile | — | — | arrow keys (native radio group, LIKELY) |
| Checkbox card | — | whole card is the label | ring on the box | — | — | Space |
| Chip toggle (Join) | border 50% accent, text ink | checkbox toggles → accent fill | ring on the pill | — | — | Space |
| Pager card | border accent, bg tint | navigate | ring | — | — | — |
| WhatsApp pop | × colour → ink | × dismisses (remembered); CTA opens group and also dismisses | ring | appears after 0.9 vh scroll | — | — |
| Banner × | opacity .65 → 1 | dismiss (per message) | ring | — | — | — |
| Legacy reel carousel | — | dots/arrows | — | — | **swipe**: track follows the finger; release past 16% of width → next/prev | ← / → |
| Legacy Q&A deck | — | prev/next: outgoing floats up-left rotating −3.5°, incoming from below rotating +3.5° | — | — | — | — |

---

## 17. Forms (UI/UX pattern only)

### 17.1 Field styling — OBSERVED
| Property | Value |
|---|---|
| Surface | `#FDF8EE` (lightest cream, "never pure white") |
| Border | **2 px solid ink** |
| Radius | **999 px** for single-line inputs on poster pages (homepage, contact capture); **12 px** inside step-card grids (`.f input`); textarea 16 px |
| Padding / type | `14px 20px`, Plex 500 1 rem (poster); grid fields `12px 14px` .95 rem |
| Placeholder | `rgba(40,40,43,.5)` (poster) / 60% muted |
| Focus | border stays ink + **`outline: 3px solid #0FF0FC; outline-offset: 0`**, an accent ring hugging the field |
| Icon fields (legacy) | 17 px stroke icon at left 15 px, input left padding 44 px |
| Labels | Above the field: Plex Mono .7 rem, +.1em, UPPER, muted, `margin-bottom:6px`; optional hint inside the label in sentence case at 70% opacity ("(optional)") |
| Group legend | Mono .62 rem UPPER muted; highlighted fragment in ink (accent on dark) |
| Spacing | Field grid gap 14 px; checkbox list gap 10–12 px; sections in a card separated by 18–22 px |

### 17.2 Validation / states — OBSERVED
- Client check on submit: email regex; invalid → `preventDefault`, `aria-invalid="true"`, focus moved to the field. An optional email left blank passes (phone accepted instead on the funnel).
- **Error look:** `border-color:#FF6B6B !important; box-shadow: 0 0 0 3px rgba(255,107,107,.18)` (focus: `.3` alpha); message `.field-err` red .85 rem below. The CSS states the rationale: on a phone the message alone is easy to miss, and the red halo points at *where* the problem is. Checkbox cards get `.chk-invalid` with the same treatment.
- **Success:** server redirect back with a query flag → a **toast** at the top of `<main>` (`role="status"`, accent bg, 2 px ink border, radius 14, 600 .92 rem); the flag is stripped from the URL.
- **Loading state:** on the donate form the submit is disabled (`opacity:.4`) and **relabelled** while the checkout is being created (OBSERVED in JS). No spinner anywhere. Other forms post normally (no loading state observed).
- **Focus-visibility caveat (OBSERVED):** the field focus ring is accent `#0FF0FC`. On the accent-coloured block the ring is accent-on-accent, so practically invisible (only the 2 px ink border remains). Avoid this when translating.
- **Turnstile (OBSERVED):** the Cloudflare widget only appears once the visitor focuses a field in that form, as a full-width row under the button.
- **Bot protection:** Cloudflare **Turnstile** widget placed as a full-width row in the form (`flex-basis:100%` / `grid-column:1/-1`); hidden honeypot input `.hp {display:none}`.

### 17.3 Compact inline form (homepage accent block)
2-column grid (`1fr 1fr`, gap 10, max 580): first/last name side by side; phone and email full-width below 600 px, side by side above; button left-aligned (`justify-self:start`); fineprint below with an underlined privacy link.

### 17.4 Checkbox & chip controls
- **Checkbox card:** custom 22 × 22 box, radius 7, 1.5 px border; checked = accent fill + ink tick drawn with two borders rotated −45°; the whole card is clickable.
- **Chips:** hidden checkbox + span pill (`padding:9px 16px`, 600 .8 rem, 1.5 px border); hover = 50% accent border; checked = accent fill + ink text.

### 17.5 Mobile behaviour (from CSS)
Grid fields collapse to a single column (`span 6`) below 700 px; amount tiles go 4 → 2 columns; the form card padding shrinks to `26px 22px` / `24px 20px`; submit stays full width.

---

## 18. Donation UX (structure only; legal/political specifics ignored)

**OBSERVED**: screenshots of all four steps, a tile-click test, the full CSS, and `donate.js` read in full.

1. **Page structure:** Hero (eyebrow "trust" line + H1 with the last word highlighted + 3-line explanatory paragraph, `max-width:52ch`) → **one `<form>`**, `max-width:760px`, gap 22, containing **four step cards** → a closing notes band (dashed chips / legal lines).
2. **Step card anatomy:** a 34 px numbered circle (mono 700, accent fill + ink border on poster) + H2 at 1.15 rem → optional note (.85 rem muted, 60ch) → controls. Each card **unfolds** as it scrolls into view and its number stamps in.
3. **Step 1, amount selection:** **4 preset tiles** in a row (2 per row below 700 px), each a `<button type="button" data-amt>`: large amount (Plex 800 1.05 rem) over a **mono uppercase caption** (what that amount unlocks, "maximum", etc.). Below: **custom amount** field (mono label "CUSTOM AMOUNT (CUR)", max-width 240, the currency symbol absolutely positioned inside the field's left edge in bold) → **one live benefit sentence** in bold → a **rules list** with em-dash bullets at .8 rem muted.
   - **Behaviour (OBSERVED, tested):** clicking a tile writes its value into the custom field and re-runs `update()`. Typing in the field highlights whichever tile matches exactly (`.is-on` = accent fill, ink border), and none if no tile matches. The tile and the field are **one source of truth: the input value**.
   - The live sentence rewrites itself as the amount changes: below a threshold it says how much more unlocks the benefit; above it, it states the effective net cost. Over the maximum, an inline error appears (`hidden` toggled) and the field gets `aria-invalid="true"`.
4. **Step 2, donor fields:** card note (muted) → 2-col pairs of mono-labelled fields (first/last; street number (narrow) + street name (wide); unit (optional hint in the label) + city (pre-filled); province `<select>` + postal code). Postal code auto-formats on blur (uppercased, space inserted). Email + optional phone.
5. **Step 3, confirmations:** note → stacked full-width **checkbox cards** with bold lead fragments.
6. **Step 4, payment method:** note → **3 equal tiles** (22 px stroke icon + uppercase 700 caption; hidden radio covering each tile) → **summary box** (paper, 2 px ink border, `5px 5px 0 accent` shadow on poster): mono uppercase rows `CONTRIBUTION …… $x`, `BENEFIT …… $y`, then a hairline-separated **net row**; "—" placeholders until an amount is valid → small muted note → **full-width ink submit** ("Continue to secure payment" pattern) → one-line mono-ish reassurance under it ("secure checkout by [processor] — card numbers never touch our servers" pattern).
   - Choosing a method that can't be processed online **disables the submit and rewrites its label** inline, and shows an explanatory note immediately, instead of bouncing server-side.
7. **Submit behaviour (OBSERVED in JS):**
   - Invalid → `preventDefault`; one red sentence that **names the exact blocking field in plain words** ("please check your postal code" style) (`role="alert"`) is inserted just above the submit; `reportValidity()`; the first invalid field is **smooth-scrolled to the centre** of the viewport.
   - Valid → **double-submit guard**: the button is disabled and relabelled with a "redirecting to secure checkout" style message, then the server redirects to a **hosted checkout (Stripe)**.
   - Returning with Back (bfcache `pageshow`) re-enables the button and clears the note.
   - The server returns `?cancelled` / `?err=<code>` → a **toast** at the top of `<main>` with a human message per error code ("nothing was charged", "your details are still filled in"…), then the query is stripped.
8. **Trust messaging placement:** top (a short transparency-promise eyebrow + paragraph), step 1 (live benefit line + rules), step 2 note (why the details are needed), step 4 (summary, processor reassurance), and a closing plain-language fine-print band: a dashed mono chip label + em-dash list.
9. **Responsive (CSS):** single column at 760 max; amount tiles 4 → 2; field pairs → full width below 700; step padding 30 → 26/22.
10. **For RBB/Razorpay:** the architecture maps 1:1. Razorpay Checkout opens a modal rather than redirecting, so the redirect-in-progress label becomes an "opening payment window" style label and is reset on the Razorpay `modal.ondismiss` callback instead of `pageshow`.

---

## 19. Footer — OBSERVED

| Property | Value |
|---|---|
| Surface | Ink block `#28282B`, paper text; no top border; `overflow:clip`; padding `34px 0 40px` |
| Height | 118 px at desktop: **deliberately thin** |
| Structure (≥700) | 3-column grid `auto | 1fr | auto`, vertically centred: **left** brand lockup (mark + 2-line text); **centre** authorisation line (Plex 700 .85 rem) above a legal line (Plex Mono .68 rem, 60% paper) containing an accent privacy link; **right** circular social icon button(s) (38 px, 1 px border at 30% paper, accent icon, border → accent on hover) |
| Mobile | Single column, centred, gap 20 |
| Decoration | The rotating-badge motif as a **static watermark** (260 px, `opacity .07`, `rotate(-12deg)`, bottom-right, partly clipped off-canvas): ring text + mark |
| Newsletter / sitemap columns | **None.** The sign-up asks live in page blocks, not the footer. |
| Animation | None |
| Join funnel variant | A minimal centred footer on paper (muted legal, ink links) |

---

## 20. Responsive System

> **Source:** shipped media queries and JS breakpoints (exact), *not* visual mobile captures (see §27). Desktop states are OBSERVED visually.

### 20.1 Breakpoints in use
| Breakpoint | What changes |
|---|---|
| `max-width: 420px` | Hero label sticker shrinks (0.82 rem, `left:-2%`) |
| `max-width: 559px` | **Nav becomes two rows** (brand + CTA / links), radius 22 |
| `max-width: 560px` | Site banner text .84 rem |
| `max-width: 600px` | Corner badge 96 → 56 px, moved to `top:122px` |
| `min-width: 600px` | Accent-block form: phone + email go side by side |
| `min-width: 700px` | **Main "tablet" switch:** section padding ×.78; hero padding 80/60; flyers 2-col; amount tiles 4-col; field pairs side by side; footer 3-col; step padding 30; legal/join cards larger padding; About stats 4-col; Q/A bubble insets increase; mandate pager 3-col |
| `min-width: 760px` | Hero becomes 2-col (`1.5fr/.7fr`); About ink 2-col text; generic `.cards` 2-col (max 760); Contact becomes single-screen |
| `min-width: 860px` | Contact cards 3-col |
| `min-width: 880px` | Mandate detail `300px | 1fr` + sticky rail |
| `min-width: 900px` | **Strategy dial goes full-size in its own sticky column**; About hero 2-col; action boxes 3-col; About closing 2-col |
| `max-width: 899px and max-height: 520px` | Strategy sticky bar becomes static (landscape phones) |
| `min-width: 960px` | Accent block 2-col (copy + steps card) |
| `min-width: 1000px` | **Hero portrait goes absolute** at the right edge; H1 sizing switches to `6.6vw` |
| `max-width: 1160px` | Toast gets side margins |
| `min-width: 1200px` | About hero media column fixed 360 px |
| `min-width: 1380px` | Corner badge moves up beside the nav (`top:16px`) |
| JS `(hover:hover) and (pointer:fine)` | Video hover-preview and phone tilt enabled only for mouse users |

### 20.2 Summary by device class
| Component | Desktop (≥1000) | Tablet (700–999) | Mobile (<700) |
|---|---|---|---|
| Nav | Single-row pill | Single-row pill | Two-row rounded block (<560), no hamburger |
| Hero | Copy left, cut-out absolute right, bleeding to bottom | 1.5 : .7 grid | Stacked: copy, then portrait (max 320 px) |
| Headline size | `6.6vw`, max 96 px | `14vw`, capped at 6.4 rem | `14vw` (≈ 2.8–3.4 rem) |
| Flyers / cards | 2-col (3-col action boxes ≥900) | 2-col | 1-col |
| Strategy | Sticky dial column + panels | Sticky pill bar + panels | Sticky pill bar + panels |
| Mandate | Sticky stat rail | Stacked stats above body (<880) | Stacked |
| Forms | Pairs side by side, 4 amount tiles | Same | Full-width fields, 2 amount tiles |
| Footer | 3-col | 3-col | Centred stack |
| Motion | Full + hover effects | Full | Same reveals; hover-only effects irrelevant; parallax still on (LIKELY, no width guard in JS) |

**Fluid typography:** almost every display size is a `clamp(min, Nvw, max)`, so type scales continuously between breakpoints rather than stepping.

---

## 21. Accessibility Observations (observed behaviour, not a compliance claim)

**Positive (OBSERVED):**
- `lang="en-CA"`; landmarks: one each of `header`, `nav[aria-label="Main"]`, `main#main`, `footer`.
- **Skip link** ("Skip to content") off-screen until focused, then appears top-left on an accent background.
- Heading order on home: H1 → H2s → H3s (logical).
- Portrait has a descriptive `alt`. Decorative marks are CSS masks or `aria-hidden`.
- All visible inputs have programmatic labels (honeypot excluded and hidden).
- `:focus-visible` ring 3 px ink, offset 3 px (poster); tile inputs show the ring via `:has(:focus-visible)`.
- `aria-current="page"` on the active nav link.
- `aria-invalid` drives the error styling; error summary uses `role="alert"`; toasts use `role="status"`.
- **Extensive `prefers-reduced-motion` support:** loader skipped, reveals instant, marquee/badge/cue/parallax stopped, carousels without transition, the wheel keeps the dimming (opacity .45) but drops blur and movement.
- Touch targets 38–52 px for icon buttons; buttons ~43–58 px tall; the strategy wedges are **disabled as tap targets below 900 px** because they'd be ~24 px.
- The nav avoids tiny type on phones by wrapping (stated rationale).
- Videos never autoplay with sound; hover preview is muted and mouse-only.
- Security headers: `X-Frame-Options: DENY`, HSTS, `nosniff`, a strict referrer policy and a permissions policy that disables camera/mic/geolocation.

**Concerns (OBSERVED or measured):**
- **Accent-on-accent focus ring:** field focus outline `#0FF0FC` is invisible on the accent block (§17.2).
- Mono metadata at **9.3–11 px** (e.g., `.58rem` step label, `.62rem` legends, 10.88 px footer legal) is small for comfortable reading.
- Inactive strategy panels are **blurred** but remain in the reading order at full opacity, so text is technically present but visually unreadable until it's current (keyboard/screen-reader users are unaffected; low-vision mouse users may find it confusing).
- The ribbon headline's text is clipped until the animation runs. The text is in the DOM throughout, so screen readers are fine.
- Strategy wedge keyboard operability: UNKNOWN (SVG hit areas with click handlers; no evidence of `tabindex`/`role="button"`).
- The rotating corner badge is `pointer-events:none` and `aria-hidden`: good, but it overlaps content on narrow screens (56 px at top right).

**Contrast (computed):** ink on accent **10.4 : 1**; ink on cream page **12.1 : 1**; muted `#625E56` on ivory **5.9 : 1**; accent on cream **1.16 : 1**, which is why the site never uses accent text on paper.

---

## 22. Technical Reconnaissance

| Area | Finding | Label |
|---|---|---|
| Framework | **None.** Static HTML pages with clean URLs (`/platform.html` → `/platform`), no hydration markers, no framework globals | OBSERVED |
| Server / backend | PHP endpoints (`/api/hit.php`, `/api/banner.php`, form actions ending `.php`); a directory listing returns 403 (Apache/LiteSpeed-style) | OBSERVED (endpoints) / LIKELY (server type) |
| CDN / edge | **Cloudflare** (`server: cloudflare`, `cf-cache-status: DYNAMIC`); Cloudflare Web Analytics beacon | OBSERVED |
| CSS methodology | Hand-written global CSS with **custom properties as tokens**, BEM-ish short prefixes per section (`.ph-*`, `.pp-*`, `.pc-*`, `.pa-*`, `.wh-*`, `.md-*`, `.jn-*`), a theme layer that re-maps tokens on `body.poster`, page-scoped files (`about.css`, `townhall.css`). Modern CSS used: `clamp()`, `min()`, `svh/dvh`, `aspect-ratio`, individual `translate`/`rotate` properties, `:has()`, `mask`, `clip-path` animation, `text-wrap: balance`, `box-decoration-break` | OBSERVED |
| JS | One IIFE vanilla file (~31 KB) + small page files (about 2 KB, donate 7 KB, event bar 2.6 KB). `IntersectionObserver`, `requestAnimationFrame`-throttled scroll handlers (passive), `matchMedia`, `navigator.share`, `sendBeacon` | OBSERVED |
| Animation libraries | **None** (no GSAP/Lenis/AOS/Framer/Swiper scripts or globals) | OBSERVED |
| Fonts | Google Fonts (Archivo Black, IBM Plex Sans, IBM Plex Mono) with preconnect; self-hosted commercial display WOFF2 | OBSERVED |
| Images | WebP (hero preloaded, 900 × 1141, no `srcset`), SVG mask/texture assets; video element on About | OBSERVED |
| Forms / anti-spam | Cloudflare **Turnstile**; honeypot field | OBSERVED |
| Payments | Server creates a **Stripe** hosted-checkout redirect | OBSERVED (JS comments/messages) |
| Analytics | First-party cookieless beacon (pageview, 15 s "engaged", 60% scroll depth, outbound/CTA clicks via one delegated listener, video play/50%, form start vs submit), respects Do-Not-Track; a per-tab session id in `sessionStorage`; campaign source code persisted for the visit | OBSERVED |
| Storage | `sessionStorage` (loader seen, session id, source), `localStorage` (WhatsApp pop dismissed, banner dismissed per hash) | OBSERVED |
| Ops | Announcement bar content is fetched (toggleable without deploy); a time-boxed event bar script self-expires by date | OBSERVED |

---

## 23. Component Architecture (conceptual, from the reference)

```
Layout (body.theme-poster)
├── SkipLink
├── AnnouncementBar (optional, fetched, dismissible)
├── Header (sticky)
│    └── NavPill
│         ├── BrandLockup (Mark + 2-line live text)
│         ├── NavLinks (aria-current)
│         └── Button[solid, nav-size]
├── CornerBadge (fixed, rotating ring text + Mark)      ← injected
├── main#main
│    ├── Toast (query-flag driven, role=status)
│    ├── PosterHero
│    │    ├── RibbonHeadline (lines[] → RibbonLine)
│    │    ├── Lead
│    │    ├── CutoutFigure + LabelSticker
│    │    ├── WatermarkMark (parallax)
│    │    └── ScrollCue
│    ├── SplitHeroWithMedia (VideoPhone, HandleChip, StickerPill[])
│    ├── CenteredPageHero (Eyebrow, H1 w/ Highlight, Lead)
│    ├── ColorBlockSection {tone: paper | ink | accent}
│    │    ├── SectionKicker (Mark + "01 / 04")
│    │    ├── SectionHeading (Highlight / RibbonHeadline)
│    │    ├── FlyerGrid → FlyerCard {tilt, link?, ArrowStamp?}
│    │    ├── Marquee
│    │    ├── StatementLines (InlineStamp)
│    │    ├── InlineForm / StepsCard (NumberedStep[])
│    │    ├── ActionBoxRow → ActionBox {tone} (DoubleMark, LinkRow[], Button[])
│    │    ├── ChatThread → QuestionBubble, AnswerBubble (StatCard → CountUpStat[])
│    │    ├── ActionRow[] (IconDisc, label, caption, ArrowDisc)
│    │    └── TicketCard (DateRow[])
│    ├── StickyDialScrolly
│    │    ├── DialStage (sticky) → SvgDial, ProgressRing, HubLabel, Hint
│    │    └── Panel[] (kicker, H3, lede, StatStrip, RulesList)
│    ├── DetailWithStickyRail
│    │    ├── StatRail (sticky) → StatCard[] (SourceLink)
│    │    ├── LongformBody → NumberedPlanList
│    │    └── Pager (Prev | All | Next)
│    ├── StepForm (Donate / Volunteer / Legal)
│    │    └── StepCard {num} (unfold)
│    │         ├── AmountTiles + CurrencyField + LiveBenefitLine + RulesList
│    │         ├── FieldGrid (6-col) → Field (mono label)
│    │         ├── CheckboxCard[] / Chip[]
│    │         ├── PaymentTiles
│    │         ├── SummaryBox (rows + net)
│    │         └── SubmitButton (guard) + BlockingNote
│    ├── ContactCards (single-screen layout)
│    ├── FunnelPage (no nav) → StampMark, WordRiseHeadline, AsideNote, UnfoldForm, Exits
│    └── CTABand
├── Footer (ink) → BrandLockup, Authorization/Legal, SocialIcon[], BadgeWatermark
├── SlideInPrompt (channel join, once per visitor)      ← injected
└── Loader (first visit per session)
```

---

## 24. Design Tokens (reference-derived, **not** RBB tokens)

```yaml
color:
  ink:            "#28282B"   # text, dark blocks, solid buttons, borders
  paper:          "#FAF4E8"   # cards, nav pill, light text on ink
  page:           "#F4E8D2"   # body background
  field:          "#FDF8EE"   # inputs, tiles, chips
  accent:         "#0FF0FC"   # highlight boxes, offset shadows, accent block, wipe bar
  muted:          "#625E56"   # secondary text on paper
  onInkBody:      "rgba(250,244,232,.82)"
  onInkMuted:     "rgba(250,244,232,.6)"
  hairline:       "rgba(40,40,43,.22)"
  error:          "#FF6B6B"
  errorHalo:      "rgba(255,107,107,.18)"
  warning:        "#FFD97A"
  channelGreen:   "#1FAE54"
  watermarkOnPaper:  "ink @ 4.5%"
  watermarkOnAccent: "ink @ 9%"
  watermarkOnInk:    "paper @ 5%"
  grainOverlay:   "grain.svg 180px, multiply, .32"

font:
  display: "Eveleth Slant → Archivo Black" (uppercase, lh .9–1.04, ls -0.015em)
  body:    "IBM Plex Sans" 400/500/600/700
  mono:    "IBM Plex Mono" 400/500/600
size:
  display-hero:  clamp(2.8rem, 6.6vw, 6rem)     # ≥1000; 14vw below
  display-bill:  clamp(2.4rem, 6.6vw, 5.4rem)
  h1:            clamp(2.1rem, 8.4vw, 4.2rem)
  h2-block:      clamp(2rem, 5.8vw, 3.6rem)
  h2:            clamp(1.55rem, 5vw, 2.5rem)
  h2-card:       clamp(1.5rem, 3.2vw, 2.1rem)
  h3:            1–1.7rem by context
  lead:          clamp(1.25rem, 2.7vw, 1.75rem)  # weight 500
  statement:     clamp(1.4rem, 3.3vw, 2.2rem)
  body:          1rem (cards 1.02–1.05rem)
  small:         .85rem
  meta-mono:     .62–.72rem, +.06–.16em, uppercase
  button:        .95rem / 700
  nav:           clamp(.8rem, 2.4vw, .95rem) / 600

space:
  wrap:          1120px (+22px gutters)
  sec-pad:       clamp(64px, 9vw, 110px)
  block-pad-lg:  clamp(76px, 9vw, 110px)
  block-pad:     clamp(56px, 8vw, 96px)
  gap-grid:      22px → 30px (≥700)
  gap-split:     40–64px
  card-pad:      26px 26px 30px → 32px 34px 36px
  field-gap:     14px
  measure:       40ch (cards) · 46–56ch (intros) · 62ch (long-form)

radius:
  pill: 999px; card: 16–18px; field-grid: 12px; tile: 14px; stamp: 6–10px; phone: 28px; nav-mobile: 22px

border:
  poster: 2px solid ink; phone: 3px; hairline 1px; dashed separators 1.5–2px

shadow (hard offsets, no blur):
  sticker-sm: 3px 3px 0 accent
  badge:      4px 4px 0 accent
  card:       5px 5px 0 accent
  flyer:      6px 6px 0 accent  → hover 10px 10px 0
  feature:    8px 8px 0 accent | ink (inverse on accent block)

breakpoints: 420 · 560 · 600 · 700 (main) · 760 · 860 · 880 · 900 (main) · 960 · 1000 (main) · 1200 · 1380

motion:
  dur-micro: .15s; dur-hover: .25–.3s; dur-reveal: .7s; dur-image: .9–1.1s; dur-sweep: 1.5s
  dur-countup: 1400ms; dur-unfold: .95s; marquee: 38s; badge: 26s; loader-fill: 1.7s
  ease-out:   cubic-bezier(.22,1,.36,1)
  ease-soft:  cubic-bezier(.33,1,.4,1)
  ease-print: cubic-bezier(.3,1,.4,1)
  ease-spring:cubic-bezier(.34,1.24,.5,1)
  ease-stamp: cubic-bezier(.34,1.56,.64,1)
  ease-unfold:cubic-bezier(.7,0,.2,1)
  reveal-distance: 26–28px (Y) · 22–52px (X)
  stagger: .1–.16s (cards/lines) · .07–.08s (words/fields)
  io-threshold: .12 (reveal) · .5 (count-up)

z-index:
  page-bg: -1; hero: 1; ink-block-over-hero: 2; sticky dial bar: 20; nav: 50; slide-in prompt: 60; banner: 60; corner badge: 70; grain overlay: 90; skip link: 99; loader: 200

image-ratios:
  cutout-portrait: 900/1141; video-phone: 9/16; legacy reel: 9/15.5; mark: 219/178
```

---

## 25. RBB Translation Recommendations (design principles only)

1. **Keep the three-role palette, not the colours.** Map *roles*: **ink** (dark surface + text), **paper** (card/page), **accent** (highlight boxes + offset shadows + one block per page). RBB's shared brand guidelines (Bright Sky Blue `#00ADEF`, Deep Trust Blue `#10437C`, Growth Green `#5CB85C`, Charcoal `#3A3A3A`, Light Gray `#F5F7FA`, White, typeface Satoshi) suggest:
   - **ink → Deep Trust Blue `#10437C`** (white on it 9.9 : 1) or Charcoal for text;
   - **paper → White / Light Gray `#F5F7FA`** (a warm cream would fight a blue palette);
   - **accent → Bright Sky Blue `#00ADEF`**.
   - **Contrast warnings (computed):** Sky Blue on white is **2.55 : 1**, so **never use it for text on light surfaces** (same rule as the reference). Deep Blue text on a Sky Blue block is only **3.9 : 1** (large display text only); Charcoal on Sky Blue is 4.45 : 1. A Sky Blue block needs **large ink headlines and short lines**, or a darker ink such as `#0B1F3A` (6.5 : 1).
   - **Growth Green** is best kept for "progress/success" moments (funding progress, success toast), mirroring how the reference reserves green for one channel.
2. **Display face:** the reference relies on a *textured, wide, all-caps* display. Satoshi is a clean geometric sans. Either keep Satoshi for UI/body and add a heavier condensed or rough display face for headlines (a licensing decision), or get the "poster" punch from Satoshi Black at the same sizes, uppercase, tight leading (.9) and the highlight/ribbon device. Keep a mono for metadata labels.
3. **Reuse the signature devices:** the highlight box on one key word per headline; a ribbon wipe on the homepage hero and one billboard line; hard offset shadows; small tilts on story/program cards that straighten on hover; the RBB mark used as a mask everywhere (watermark, kicker bullet, marquee separator, double print, loader). A rotating ring badge is optional (it's very campaign-flavoured).
4. **Photography is the main departure.** NGO storytelling needs real photos (beneficiaries, programs). The reference uses one cut-out. Recommendation: keep photos **rectangular, inside paper "print" frames with the 2 px ink border + offset shadow + slight tilt** (like the video phone), not full-bleed glossy imagery. Make sure the people shown have consented and are portrayed with dignity.
5. **Motion budget:** carry over the loader-once-per-session, the staged hero, the 26 px reveals, flyer hover and the count-up (ideal for impact numbers). Use the sticky dial only if RBB has a fixed set of 4–6 programs. Keep every reduced-motion branch.
6. **Fix the reference's weak spots:** a visible focus ring on every block colour (e.g., ink ring on the accent block); body-size minimum ≥12 px for mono metadata; panel dimming via opacity *and* blur reset for low-vision users; real mobile testing of the sticky bar.
7. **Donation:** keep the numbered step-card flow, preset tiles + custom field as one source of truth, the live "your gift does X" line (an impact line instead of a tax-rebate line), the summary box, the blocking note that names the exact field, and the double-submit guard. Adapt it to Razorpay Checkout's modal (§18.10).

---

## 26. What Should NOT Be Copied

- Any **text**: headlines, slogans, policy statements, Q&A wording, form microcopy verbatim, legal lines, authorisation lines.
- **Names, handles, links** (social handles, community links, emails), election dates, voter information, the countdown target, or the "how to vote" content.
- **The portrait**, video and any photography; the campaign **mark** (`mark.svg`) and wordmark lockup; the corner-badge ring text.
- The **licensed display font file** (Eveleth Slant): use a font RBB licenses itself.
- **Source code** (CSS/JS) verbatim: re-implement from this spec.
- The exact **combination** of the reference's cyan `#0FF0FC` + ink `#28282B` + cream `#F4E8D2`: use RBB's palette.
- Political-only patterns: election countdown, voting steps card, "authorised by" line, contribution-limit/eligibility confirmations, rebate maths.
- Its analytics/tracking specifics and endpoints.

---

## 27. Unknowns / Items Requiring Visual Verification

| # | Item | Why unknown | How to verify |
|---|---|---|---|
| 1 | **All mobile/tablet rendering** (two-row nav, stacked hero, sticky strategy bar, field collapse) | Window couldn't be resized; `X-Frame-Options: DENY` blocks iframe emulation | Chrome DevTools device toolbar at 375 / 414 / 768 px |
| 2 | Remaining strategy slugs (3 of 6 found: auto-theft, cost-of-living, gridlock) | No sitemap; detail pages aren't linked from the hub | Follow pager links from each detail page |
| 3 | Video file format/encoding on About | Not inspected | Network panel |
| 4 | Keyboard operability of strategy dial wedges | Not tested | Tab through /platform at ≥900 px |
| 5 | WhatsApp slide-in prompt visual in poster style | Didn't appear during the session (likely already dismissed in this browser) | Clear `localStorage` and wait 9 s |
| 6 | Exact parallax behaviour on touch devices | No width/pointer guard in JS; not observed | Real phone |
| 7 | `/townhall` page design | Gated/expired event | — (low priority) |
| 8 | Form success pages/redirect timing | Not submitted (no real data entered, by design) | Staging test |
| 9 | Two same-origin stylesheet links with UUID-like paths seen on /platform | Origin unclear (possibly extension-injected) | Disable extensions and recheck |
| 10 | Whether `/strategy/*` pages will get the 5-link nav | Inconsistent today | — |
| 11 | Loader visibility on slow networks (shows until `load` + 400 ms, max 2.6 s) | Only seen on a fast connection | Throttled network |

---

# HOW TO TRANSLATE THIS INTO RISING BEYOND BORDERS

*Design-concept mapping only: no RBB content written here.*

| Reference pattern | → RBB destination | What carries over | What changes |
|---|---|---|---|
| **Loader** (mark pulse + fill bar, once per session) | RBB first-visit loader | Same timing (≤2.6 s cap) and once-per-session rule | RBB mark; Deep Blue / Sky Blue |
| **Sticky pill nav** + two-row mobile | RBB global header | Pill, live-text lockup, flat links, one solid CTA ("Donate"), `aria-current` styling | 5–6 RBB sections; CTA colour = accent on hover |
| **PosterHero** (ribbon headline, cut-out, faint mark, cue, parallax) | **RBB Home hero** | 3-line ribbon headline, lead line, watermark mark, scroll cue, 3-plane parallax | Swap the cut-out for a framed, tilted story photo (or a consented cut-out of a beneficiary/volunteer); add a primary CTA if desired (the reference has none) |
| **Ink block + 4 flyers + CTA + marquee** | **RBB Programs / Our Work overview** | Tilted paper cards with offset shadow, mark double-print icon, hover straighten/lift, 2 × 2 grid, closing CTA, marquee of program names/mark | Program titles + 1-line descriptions; flyers become links (use the About flyer-with-arrow variant) |
| **Accent block: statement + inline stamp + form + steps card** | **RBB Impact / "How your gift helps"** or newsletter sign-up | Inline stamp number inside a sentence, compact form, paper steps card with ink shadow | Impact figures in stamps; steps = "How giving works" or "How we deliver" |
| **Count-up stat card** (About Q&A) / **Stat cards** (mandate rail) | **RBB Impact metrics** | 1400 ms ease-out count-up at 50% visibility; numbers on accent boxes; mono "SOURCE" links | RBB metrics with sources (reports) |
| **Billboard + 3 colour action boxes** | **RBB Get Involved** (Donate / Volunteer / Spread the word) | Three equal boxes in three tones, corner double-printed mark, link rows with icon discs | Channels and buttons for RBB |
| **SplitHeroWithMedia + jump stickers** | **RBB Who We Are hero** | Copy + tilted media frame (video or photo), sticker pills linking to sub-sections | Founder/team film or photo; RBB chapters |
| **InkStoryTwoColumn** (kicker 01/04, pull-quote, 2-col) | **RBB Mission / Story** | Chapter kickers, highlighted pull-quote, 2-col narrative, marquee | RBB mission text |
| **ChatThreadQA** | **RBB FAQ** (donor questions: where money goes, transparency) | Question bubble / answer bubble rhythm, side reveals, embedded stat card | RBB Q&A |
| **FlyerLinkGrid** (About) | **RBB Focus areas / Projects index** | Linked flyers with arrow stamp | RBB projects |
| **InkClosingWithTicket** | **RBB closing CTA** (e.g., appeal deadline / event) | Action rows + tilted ticket with big dates | Appeal or event dates (only when real) |
| **StickyDialScrolly** (Strategy hub) | **RBB Programs deep page** (only if 4–6 fixed programs) | Sticky dial, reading line, progress ring, panel focus/blur, click-to-scroll; mobile sticky bar | Segment count = number of programs; reduce blur intensity |
| **DetailWithStickyRail** (mandate page) | **RBB Program / Project detail** and **Story detail** | Breadcrumb eyebrow, sticky stat rail, Problem → Approach numbered list, prev/all/next pager, CTA band | Project facts in the rail; numbered "what we do" list; story pages could swap the stat rail for a photo rail |
| **NumberedStepForm** (Volunteer) | **RBB Volunteer / Partner forms** | Step cards, mono labels, checkbox-card grid, consent card, unfold | RBB fields |
| **Donation step flow** | **RBB Donate (Razorpay)** | Hero trust line; Step 1 preset tiles + custom field (single source of truth) + live impact sentence; Step 2 donor details (6-col grid); optional Step 3 confirmations (e.g., 80G receipt opt-in / PAN, if applicable); summary box; blocking note naming the field; double-submit guard; toast for cancel/error | Razorpay modal instead of redirect; INR formatting; one-time vs monthly toggle can reuse the chip control; payment-method tiles may be unnecessary (Razorpay shows its own) |
| **SingleScreenContact** | **RBB Contact** | Centred mark-logo hero + 3 equal channel cards (icon tile, mono handle, outline button pinned to bottom), fits one desktop screen | RBB channels |
| **FunnelPage** (no nav, word-rise headline, unfold form, sheen submit) | **RBB campaign / QR landing pages** (appeals, events) | Single-action layout, exits after the form, no slide-in prompt | Appeal-specific content |
| **Legal cards** (Privacy) | **RBB Privacy / Terms / Refund policy** | 776 px column, numbered legal cards, accent-rule intro, mono "last updated" | RBB legal text |
| **Toast system** | RBB post-submit / payment-result messages | `role="status"`, top of main, query flag stripped | RBB messages |
| **Footer** (thin ink band, badge watermark) | **RBB Footer** | Ink band, brand lockup left, legal centre, social right, faint mark watermark | Add NGO essentials the reference lacks: registration numbers, address, quick links, newsletter (if wanted) |
| **Cards (all variants)** | **RBB Programs / Stories / Projects / Get Involved** | Flyer = program; Flyer-link = project; Step card = forms; Stat card = impact; Pager card = story navigation | Story cards will need an image slot (framed print style, §25.4) |
| **Slide-in channel prompt** | RBB WhatsApp/newsletter prompt (optional) | Once per visitor, 9 s or 0.9 vh scroll, dismiss remembered, opt-out on funnel/donate pages | RBB channel |
