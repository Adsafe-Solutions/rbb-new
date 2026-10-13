# Admin content — Projects

Content to enter by hand in the Admin (**Content → Projects → New project**),
one record per project, exactly as the website holds it today in
`apps/web/src/content/work.js` (`PROJECT_RECORDS`). Ten projects, in the
order below (the order on the website is the Projects list's order; set it
with **Move up / Move down** on the Projects page after creating them).

> **Status of this content.** All ten are the website's SAMPLE projects
> (proposed copy, decision D13 in `apps/web/docs/RBB_CONTENT_DECISION_REGISTER.md`):
> real-sounding, but not verified work of RBB. Enter them only if RBB
> confirms them, or edit them into real projects before submitting for
> review. Their photographs are stock placeholders (Pexels, listed per
> project) — **do not upload those**; use RBB's own photographs or leave
> the Photograph empty.

## Where a project appears on the website

| Field in the Admin | Where it shows |
| --- | --- |
| Title, Description, Photograph, Stage | Project cards on **/work/projects** (the Projects list, grouped by program), on **/work** (the hub's featured projects — only projects with "Feature this project"), on the project's **program page** `/work/<program>` ("Projects" band), and on the **homepage** featured projects (featured only). The card shows: photo, Stage as a small label, Title, Description, and "Program · Location" as its meta line |
| Web address | The project page **/work/projects/<address>**; stories name the project by it |
| Program | Links the project to its program area; shown as "Program area" in the page's facts and on cards |
| Description | Under the title on the project page, and on cards |
| Photograph | Beside the title on the project page (with its caption from the media library, if any) and on cards |
| Location, Stage | The facts list on the project page ("Location", "Status") and the card's meta/label |
| The challenge | Section "The challenge" on the project page (paragraphs) |
| What this work focuses on | Section "What this work focuses on" (bullet list) |
| How the work is approached | Section "How the work is approached" (paragraphs) |
| What it aims to change | Section "What it aims to change" (bullet list) |
| Impact figures | Section "Impact" — each shown as "value — label". Only VERIFIED results |
| Partners | Section "Partners" (one per line) |
| Story | Section "Story": a link to the story that tells this work, with the story's own title and excerpt |
| Date | The homepage project timeline (newest first); the card there shows the date, else the Stage |
| Feature this project | Puts the project among the featured projects on /work and the homepage |
| SEO title / description / social image | The page's `<title>`, meta description and share image |

The project page always ends with "Related work" (other projects of the
same program) and the "Continue exploring." closing band — nothing to enter.

Lists need at least one item and no repeats. Paragraph fields: separate
paragraphs with a blank line. Fields not listed under a project below are
left empty (Location, Stage, Date, Impact figures, Partners, Story, SEO —
none of the sample projects set them).

Workflow after saving: **Submit for review** → an owner **Approves** →
the next **Publish** puts them live. Once ANY project is published, the
CMS projects replace the website's own list entirely, so publish the set
you want shown together.

---

## 1. Community Reading Clubs

| Field | Value |
| --- | --- |
| Title | `Community Reading Clubs` |
| Web address | `community-reading-clubs` |
| Program | Education (`education`) |
| Description | `After-school reading clubs that give children regular, relaxed time with books and an encouraging adult.` |
| Photograph | Website placeholder: `demo-edu-reading-circle.jpg` (Pexels stock) — alt "A woman reading a book aloud to a small group of young children seated around her". Use RBB's own photo or leave empty |
| Feature this project | ☑ Yes |

**The challenge**

Many children finish their first years of school still unsure of their reading. Classrooms are busy, books at home can be scarce, and a child who falls behind early often stays behind.

Reading clubs offer something simple: time, books and encouragement, away from the pressure of marks.

**What this work focuses on**
- Regular reading time in a calm, welcoming space
- Books chosen for different ages and reading levels
- Reading aloud, storytelling and games that build confidence

**How the work is approached**

Clubs are shaped with families and schools, so they fit around the school day and the languages children speak at home.

Volunteers are prepared to support reading without turning it into another lesson, and children help each other as they grow in confidence.

**What it aims to change**
- Children who enjoy reading and choose to read
- More confidence in class
- Families more involved in their children's learning

---

## 2. Learning Materials for Classrooms

| Field | Value |
| --- | --- |
| Title | `Learning Materials for Classrooms` |
| Web address | `classroom-supplies` |
| Program | Education (`education`) |
| Description | `Books, notebooks and teaching materials for classrooms that have too few — chosen with the teachers who use them.` |
| Photograph | Placeholder: `demo-edu-rural-classroom.jpg` (Pexels) — alt "Children sitting on the floor of a classroom, writing in notebooks" |
| Feature this project | ☐ No |

**The challenge**

When learners share one book between several, lessons slow to the pace of the page-turn. Teachers spend their time copying onto the board instead of teaching, and the children who most need help get the least of it.

**What this work focuses on**
- Materials matched to what is being taught
- Guidance for teachers on using them well
- Replacing what wears out, so the difference lasts

**How the work is approached**

Teachers decide what is needed — not a standard list chosen from far away.

Materials are sourced as close to the school as possible, and checked on later to make sure they are in use rather than in a cupboard.

**What it aims to change**
- Every learner with the materials to take part
- More of the lesson spent teaching
- Teachers better equipped to support every child

---

## 3. Teacher Mentoring Network

| Field | Value |
| --- | --- |
| Title | `Teacher Mentoring Network` |
| Web address | `teacher-mentoring` |
| Program | Education (`education`) |
| Description | `Pairing newer teachers with experienced colleagues, for support through their first years in the classroom.` |
| Photograph | Placeholder: `demo-edu-teacher-classroom.jpg` (Pexels) — alt "A teacher at the front of a classroom leading a lesson with students at their desks" |
| Feature this project | ☐ No |

**The challenge**

New teachers often start alone: a full classroom, little preparation time and no one to ask. Many leave the profession early — and their pupils lose a teacher just as they were getting to know them.

**What this work focuses on**
- Regular conversations between mentor and teacher
- Small peer groups to share what works
- Practical help with planning and inclusive teaching

**How the work is approached**

Mentoring is built on trust, not inspection: teachers set their own goals and decide what they want help with.

What works in one classroom is shared with others, so good practice spreads between schools.

**What it aims to change**
- Teachers who feel confident and supported
- Classrooms that include every learner
- Experienced teachers whose knowledge is passed on

---

## 4. Community Health Days

| Field | Value |
| --- | --- |
| Title | `Community Health Days` |
| Web address | `community-health-days` |
| Program | Health & Wellbeing (`health-wellbeing`) |
| Description | `Open days that bring basic health checks, information and advice closer to families who live far from a clinic.` |
| Photograph | Placeholder: `demo-health-checkup.jpg` (Pexels) — alt "A doctor in a white coat listening to a patient's breathing with a stethoscope" |
| Feature this project | ☑ Yes |

**The challenge**

Distance, cost and a day's lost earnings can all delay a visit to a clinic. Small health problems go unchecked until they become serious ones.

**What this work focuses on**
- Basic health checks in a familiar community setting
- Clear, practical health information
- Referrals to the services people can use afterwards

**How the work is approached**

Health days are planned alongside the health services people already use, so they strengthen those services rather than replace them.

Checks are private and respectful, and anyone who needs more care leaves knowing where to go next.

**What it aims to change**
- Health concerns noticed earlier
- Families better informed about their health
- Stronger links between communities and local services

---

## 5. Clean Water Close to Home

| Field | Value |
| --- | --- |
| Title | `Clean Water Close to Home` |
| Web address | `clean-water-points` |
| Program | Health & Wellbeing (`health-wellbeing`) |
| Description | `Keeping community water points working, so clean water stays close to home.` |
| Photograph | Placeholder: `demo-health-water-pump.jpg` (Pexels) — alt "Children gathered around a hand pump, filling containers with water" |
| Feature this project | ☐ No |

**The challenge**

When a water point breaks, the walk for water gets longer — often for women and children — and some families turn to sources that are not safe to drink.

**What this work focuses on**
- Repair and regular maintenance of water points
- Communities caring for their own water points
- Hygiene awareness, especially in schools

**How the work is approached**

A water point lasts when the people who use it can look after it, so communities are supported to organise its care and pay for small repairs.

Repairs use skills and parts that can be found locally, so the next breakdown does not have to wait for outside help.

**What it aims to change**
- Water that is reliable and safe
- Time given back to the people who fetch it
- Fewer illnesses linked to unsafe water

---

## 6. Tailoring Skills Course

| Field | Value |
| --- | --- |
| Title | `Tailoring Skills Course` |
| Web address | `tailoring-skills` |
| Program | Livelihoods (`livelihoods`) |
| Description | `A practical tailoring course for people who want to earn from a skill they can practise close to home.` |
| Photograph | Placeholder: `demo-live-sewing.jpg` (Pexels) — alt "A person in a red top guiding fabric through a sewing machine" |
| Feature this project | ☑ Yes |

**The challenge**

For people with caring responsibilities, work far from home is often out of reach. A practical skill that can be used from home or nearby opens a door to earning that fits around the rest of life.

**What this work focuses on**
- Hands-on tailoring skills, learned by making
- The basics of pricing, costs and record-keeping
- Help with tools and getting started

**How the work is approached**

Sessions are arranged around participants' other responsibilities, and learning happens through real pieces of work.

Those who complete the course are encouraged to share their skills with the next group.

**What it aims to change**
- A skill that can earn an income
- Confidence to set prices and find customers
- A network of people who support one another

---

## 7. Support for Small Traders

| Field | Value |
| --- | --- |
| Title | `Support for Small Traders` |
| Web address | `market-traders` |
| Program | Livelihoods (`livelihoods`) |
| Description | `Training and peer support that help small market traders keep records, plan ahead and grow.` |
| Photograph | Placeholder: `demo-live-market.jpg` (Pexels) — alt "A woman arranging tomatoes and vegetables on her market stall" |
| Feature this project | ☐ No |

**The challenge**

Small traders often work on thin margins, where a single bad week can wipe out savings. Without records, it is hard to see which goods make money and which quietly lose it.

**What this work focuses on**
- Simple record-keeping that fits a busy stall
- Planning for slow seasons
- Savings and peer groups

**How the work is approached**

Training starts from traders' own experience of their market, not a textbook.

Peer groups let traders compare notes, solve problems together and keep each other going.

**What it aims to change**
- Steadier incomes
- Savings to fall back on
- Traders able to plan rather than react

---

## 8. Resilient Smallholder Farming

| Field | Value |
| --- | --- |
| Title | `Resilient Smallholder Farming` |
| Web address | `smallholder-farming` |
| Program | Livelihoods (`livelihoods`) |
| Description | `Practical support that helps small-scale farmers grow more reliably as seasons become harder to predict.` |
| Photograph | Placeholder: `demo-live-harvest.jpg` (Pexels) — alt "Farmers in straw hats loading harvested crops onto a trailer in a field" |
| Feature this project | ☐ No |

**The challenge**

Small farms feed families and local markets, but they have little margin for a failed season. Unpredictable rain and tired soil make every harvest a risk.

**What this work focuses on**
- Seeds and tools suited to local conditions
- Soil and water practices that protect the land
- Farmers learning from one another

**How the work is approached**

Local knowledge comes first: farmers already know their land, and new practices are tested alongside what already works.

Farmer-to-farmer learning means good ideas travel further than any single training day.

**What it aims to change**
- More reliable harvests
- Households better able to withstand a poor season
- Land kept productive for the next generation

---

## 9. Essential Support Packs

| Field | Value |
| --- | --- |
| Title | `Essential Support Packs` |
| Web address | `essentials-distribution` |
| Program | Community Support (`community-support`) |
| Description | `Food and essentials for households facing a hard period, planned and delivered with local volunteers.` |
| Photograph | Placeholder: `demo-comm-packing.jpg` (Pexels) — alt "Volunteers in gloves packing donation boxes at a table" |
| Feature this project | ☐ No |

**The challenge**

Illness, the loss of work or a sudden emergency can leave a household without the basics. Support that arrives quickly — and respectfully — can stop a hard month from becoming a crisis.

**What this work focuses on**
- Packs of food and everyday essentials
- Delivery to households who cannot easily travel
- Connecting families with longer-term support

**How the work is approached**

Support is given with dignity: discreetly, and with choice wherever possible.

Local volunteers, who know their neighbourhoods, help plan who is reached and follow up afterwards.

**What it aims to change**
- Households supported through a difficult period
- Families connected to services that can help further
- A volunteer network ready to respond

---

## 10. Community Information Days

| Field | Value |
| --- | --- |
| Title | `Community Information Days` |
| Web address | `community-information-days` |
| Program | Community Support (`community-support`) |
| Description | `Open days where people can find out about the services, support and opportunities around them.` |
| Photograph | Placeholder: `demo-comm-gathering.jpg` (Pexels) — alt "A large group of people sitting and standing together on the grass at an outdoor gathering" |
| Feature this project | ☐ No |

**The challenge**

Help often exists but goes unused: people do not know about it, cannot tell whether it is for them, or find it hard to approach. Information days bring it into one welcoming place.

**What this work focuses on**
- Clear information in everyday language
- A chance to meet local services face to face
- Space to ask questions without pressure

**How the work is approached**

Each day is shaped by the questions residents raise beforehand.

Times, venues and languages are chosen so that the people most likely to miss out can take part.

**What it aims to change**
- People who know where to turn
- Services that reach more of the people they are for
- Stronger connections within the community

---

## Checklist before publishing

- [ ] Each project saved as a draft, then **Submit for review**; an owner **Approves**.
- [ ] Order set on the Projects page (the list above is the website's order).
- [ ] Photographs: RBB's own, with alt text in the media library (required before approval when a photo is set) — never the Pexels placeholders.
- [ ] Impact figures only for verified results; otherwise leave empty.
- [ ] Publish all ten together: the first published project replaces the website's whole project list.
