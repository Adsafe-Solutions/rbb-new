# Admin content — Stories

Values for **every field of the Admin's "New story" form** (Content →
Stories → New story), for three stories. They follow the website's own
stories in `apps/web/src/content/stories.js`; where the website leaves a
field empty (date, author, location, quotes, impact, SEO), a **proposed**
value is given so the form is complete — proposed values are marked
⚠ and need RBB's confirmation before the story is published.

> **Status of this content.** These are the website's SAMPLE stories
> (decision D15 in `apps/web/docs/RBB_CONTENT_DECISION_REGISTER.md`): no
> real people, places or figures. Quotes must be words a real person
> said, with permission; Impact lines must be verified change; Author
> must be a real, consenting person or the organization. The photographs
> named are Pexels placeholders the website uses — **do not upload them**;
> upload RBB's own photographs (with alt text) or leave the image empty.

## Where each field shows on the website

| Form field | Where it appears |
| --- | --- |
| Title | Story page heading; every story card (/stories hub, homepage "Stories" block, Impact page, "Related stories") |
| Web address | The page URL `/stories/<address>`; projects and the Impact page name the story by it |
| Type of story | The small label on cards and the page; the "Types of story" filter on /stories |
| Excerpt | Under the title on the page; on cards |
| Date | Byline on the page (formatted date); orders the stories list (newest first) |
| Author | Byline: "By <author>" |
| Location | "Location" row on the page |
| Feature this story | The one "In focus" story at the top of /stories |
| Story (paragraphs / headings / lists) | The article body; the first paragraph opens with a drop cap |
| Quotes | Pull-quotes after the article: the words, and who said them |
| Impact lines | The "Impact" row after the article |
| Image | Top of the story page (with the media-library caption, if any) and on every card |
| Gallery | Photographs after the article, in order |
| Program area, Project | "Related work" at the end of the page (links to the program page and the project page); the project page links back under "Story" |
| Related stories | "Related stories" cards at the end of the page. **Until stories are managed in the CMS the field takes the website's own story ids, comma-separated**; once your stories exist in the CMS, pick them instead |
| SEO title / SEO description / Social image | The page's `<title>`, meta description, share image (defaults: title, excerpt, the Image) |
| Keep out of search engines | `noindex` for the page — leave unchecked |
| Publishing | Create the story first, then Submit for review → an owner Approves → the next website Publish puts it live |

**Before you start:** create the projects (`docs/admin-content/projects.md`)
so the Project dropdown offers them. **Once any story is published, the
CMS stories replace the website's stories entirely** — and the website's
Impact page names `a-classroom-with-enough-books` and
`from-one-sewing-machine` by address — so publish your set together and
check /impact afterwards.

---

## Story 1 — Learning to read, together

### Basic information

| Field | Value |
| --- | --- |
| Title | `Learning to read, together` |
| Web address | `learning-to-read-together` |
| Type of story | `Field Stories` |
| Excerpt | `Why a quiet hour with books, a little patience and no marks can matter as much as any lesson.` |
| Date | ⚠ `15/09/2026` (proposed; the website shows no date) |
| Author | ⚠ `Rising Beyond Borders` (proposed; or the real author's name, with consent) |
| Location | ⚠ `Pune, Maharashtra` (proposed; only a place RBB confirms) |
| Feature this story on the stories page | ☑ checked (the one "In focus" story) |

### The story

Add four **Paragraph** blocks:

1. `Most afternoons the room is noisier than a library should be. Children arrive straight from school, drop their bags and go looking for the book they were halfway through the day before.`
2. `Reading clubs start from a simple observation: the children who struggle to read in class are often the ones who never get to read for pleasure. Here there are no marks, and no one is in a hurry.`
3. `A volunteer reads aloud first, then steps back. Older children begin to help younger ones. A parent waiting at the door sometimes stays to listen, and leaves with a book to share at home.`
4. `The lesson for anyone planning this kind of work is that confidence comes before fluency. A child who believes reading is for them will practise; a child who does not will find reasons not to.`

(No headings or lists in this story.)

### Quotes — ⚠ proposed; replace with real, permitted words or leave empty

| Words | Who said it |
| --- | --- |
| `Nobody tells me to read faster here. I just read.` | `A reading club member, aged 9` |
| `I came to wait for my daughter and ended up staying for the story.` | `A parent at the reading club` |

### Impact — ⚠ proposed; only verified change, else leave empty

- `Children choosing a book to take home each week`
- `Teachers reporting more confident reading aloud in class`

### Images

| Field | Value |
| --- | --- |
| Image | RBB's own photograph of a reading session (website placeholder: `demo-edu-reading-circle.jpg`, Pexels — alt "A woman reading a book aloud to a small group of young children seated around her") |
| Gallery | Two photographs (placeholders: `demo-edu-girl-reading.jpg` — "A young girl standing among trees, smiling as she reads a picture book"; `demo-edu-teacher-classroom.jpg` — "A teacher at the front of a classroom leading a lesson with students at their desks") |

### Related work

| Field | Value |
| --- | --- |
| Program area | `Education` |
| Project | `Community Reading Clubs` |
| Related stories | `a-classroom-with-enough-books, packing-day` (website ids; once stories 2 and "What goes into a packing day" exist in the CMS, pick them instead) |

### SEO

| Field | Value |
| --- | --- |
| SEO title | `Learning to read, together — a reading club story` (49 chars) |
| SEO description | `Inside an after-school reading club: why a quiet hour with books, a little patience and no marks can matter as much as any lesson.` (131 chars) |
| Social image | leave empty (defaults to the Image) |
| Keep out of search engines | ☐ unchecked |

### Publishing
Save → **Submit for review** → owner **Approve** → website **Publish**.

---

## Story 2 — When every learner has a book

### Basic information

| Field | Value |
| --- | --- |
| Title | `When every learner has a book` |
| Web address | `a-classroom-with-enough-books` |
| Type of story | `Impact Stories` |
| Excerpt | `Shared textbooks slow a whole class down. What changes when materials stop being the bottleneck?` |
| Date | ⚠ `02/09/2026` (proposed) |
| Author | ⚠ `Rising Beyond Borders` (proposed) |
| Location | ⚠ `Pune district, Maharashtra` (proposed; only a confirmed place) |
| Feature this story on the stories page | ☐ unchecked |

### The story

Four **Paragraph** blocks:

1. `Picture a lesson where one book is shared between several learners. The teacher reads the exercise aloud, copies it onto the board, and waits while it is copied again into notebooks. Half the lesson is gone before the learning starts.`
2. `Materials seem like the least interesting part of education, until they are missing. Then they decide how fast a class can move, which children keep up and how much of a teacher's skill ever reaches the room.`
3. `Asked what they need, teachers rarely ask for much: enough readers to go round, notebooks, a few things to make an idea visible. The difference is less about the objects than about the time and attention they free up.`
4. `Change of this kind is easy to count and easy to overstate. The better question is the one teachers ask themselves: did more children understand today than yesterday?`

### Quotes — ⚠ proposed; replace with real, permitted words or leave empty

| Words | Who said it |
| --- | --- |
| `I used to spend the first ten minutes writing the exercise on the board. Now we start.` | `A primary school teacher` |

### Impact — ⚠ proposed; only verified change, else leave empty

- `One textbook per learner in the classrooms supplied`
- `Lesson time spent teaching rather than copying`

### Images

| Field | Value |
| --- | --- |
| Image | RBB's own classroom photograph (placeholder: `demo-edu-rural-classroom.jpg`, Pexels — alt "Children sitting on the floor of a classroom, writing in notebooks") |
| Gallery | none |

### Related work

| Field | Value |
| --- | --- |
| Program area | `Education` |
| Project | `Learning Materials for Classrooms` |
| Related stories | `learning-to-read-together` |

### SEO

| Field | Value |
| --- | --- |
| SEO title | `When every learner has a book — learning materials` (50 chars) |
| SEO description | `What changes in a classroom when textbooks and notebooks stop being the bottleneck: more of the lesson spent teaching, and every learner able to take part.` (154 chars) |
| Social image | leave empty |
| Keep out of search engines | ☐ unchecked |

### Publishing
Save → Submit for review → Approve → Publish.

---

## Story 3 — Water close to home

### Basic information

| Field | Value |
| --- | --- |
| Title | `Water close to home` |
| Web address | `water-close-to-home` |
| Type of story | `Community Stories` |
| Excerpt | `A working water point changes the shape of a day — most of all for the people who used to fetch water from far away.` |
| Date | ⚠ `20/08/2026` (proposed) |
| Author | ⚠ `Rising Beyond Borders` (proposed) |
| Location | ⚠ `Pune district, Maharashtra` (proposed; only a confirmed place) |
| Feature this story on the stories page | ☐ unchecked |

### The story

Four **Paragraph** blocks:

1. `When a water point stops working, the change is not only in what people drink. The walk to the next source eats into the morning; children arrive late to school; water that is not safe starts to look good enough.`
2. `Repairing a pump is the easy part. Keeping it working is harder, and it depends less on engineering than on organisation: who notices the first sign of trouble, who holds the money for spare parts, who knows how to fix it.`
3. `Where a community takes on that care for itself, a water point stops being a gift that can break and becomes something people own. That is the difference between a repair and a lasting change.`
4. `It is a pattern that runs through community health work: the most valuable support is often the kind that makes outside help less necessary next time.`

### Quotes — ⚠ proposed; replace with real, permitted words or leave empty

| Words | Who said it |
| --- | --- |
| `We keep a small fund for parts now. The last repair took an afternoon, not a month.` | `A member of the water point committee` |

### Impact — ⚠ proposed; only verified change, else leave empty

- `Water points repaired and maintained by their communities`
- `Shorter walks for water for the families who fetch it`

### Images

| Field | Value |
| --- | --- |
| Image | RBB's own photograph of a water point (placeholder: `demo-health-water-pump.jpg`, Pexels — alt "Children gathered around a hand pump, filling containers with water") |
| Gallery | One photograph (placeholder: `demo-health-drinking-water.jpg` — "A child bending to drink water flowing from a hand pump") |

### Related work

| Field | Value |
| --- | --- |
| Program area | `Health & Wellbeing` |
| Project | `Clean Water Close to Home` |
| Related stories | `health-day-in-the-square` |

### SEO

| Field | Value |
| --- | --- |
| SEO title | `Water close to home — keeping water points working` (50 chars) |
| SEO description | `Why repairing a pump is the easy part: how communities that care for their own water points turn a repair into lasting, reliable, safe water close to home.` (156 chars) |
| Social image | leave empty |
| Keep out of search engines | ☐ unchecked |

### Publishing
Save → Submit for review → Approve → Publish.

---

## The other five website stories

The website also holds `health-day-in-the-square` (Field), `from-one-sewing-machine` (Impact), `market-day` (Community), `packing-day` (News & Updates) and `new-volunteer-programme` (News & Updates) — their titles, excerpts, bodies, programs, projects and related stories are in `apps/web/src/content/stories.js` in the same shape as above. Ask for them if you want them laid out field by field too.

## Checklist before publishing

- [ ] Projects created first; Program area and Project picked.
- [ ] Every ⚠ value confirmed by RBB or removed (dates, author, locations, quotes, impact lines).
- [ ] Exactly one story featured.
- [ ] Photographs are RBB's own, with alt text in the media library.
- [ ] Related stories re-picked from the CMS once the related stories exist there.
- [ ] Submit → Approve → Publish together; then check /stories, the homepage "Stories" block and /impact.
