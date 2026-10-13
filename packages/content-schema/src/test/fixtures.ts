/* Valid records, one per schema — each test changes one thing about a
   copy and checks the contract's answer. */

const base = { orgId: "rbb", schemaVersion: 1, status: "published" } as const;

export const statement = () => ({
  id: "situation",
  type: "statement",
  enabled: true,
  version: 1,
  data: { heading: "The situation", body: ["When a crisis strikes, the first days matter most."] },
});

export const appeal = () => ({
  ...base,
  id: "emergency-appeal-01",
  kind: "emergency",
  slug: "emergency-appeal-01",
  title: "Emergency Appeal 01",
  summary: "Families need essentials quickly.",
  imageId: "working-relief-packing",
  highlight: { label: "Emergency Relief" },
  sections: [
    statement(),
    {
      id: "response",
      type: "numberedCards",
      enabled: true,
      version: 1,
      data: { heading: "How your support helps", items: [{ title: "Immediate essentials" }] },
    },
  ],
  releaseMarker: "Sample event — sample appeal",
});

export const donationForm = () => ({
  frequencyOptions: { oneTime: true, monthly: false },
  currency: null,
  presetAmounts: [500, 1000],
  allowCustomAmount: true,
  minimumAmount: 100,
  maximumAmount: 1000000,
});

export const post = () => ({
  ...base,
  id: "why-we-start-by-listening",
  type: "blog",
  slug: "why-we-start-by-listening",
  title: "Why we start by listening",
  date: "2026-09-18",
  category: "reflections",
  body: [
    { type: "heading", level: 2, children: [{ type: "text", text: "Listening first" }] },
    {
      type: "paragraph",
      children: [
        { type: "text", text: "Every piece of work ", marks: ["italic"] },
        { type: "link", href: "/get-involved", children: [{ type: "text", text: "begins here" }] },
      ],
    },
    { type: "list", style: "bullet", items: [[{ type: "text", text: "Ask" }], [{ type: "text", text: "Listen" }]] },
  ],
});

export const event = () => ({
  ...base,
  id: "community-dinner-november",
  slug: "community-dinner-november",
  title: "Community dinner",
  summary: "An evening for supporters, volunteers and neighbours.",
  about: [{ type: "paragraph", children: [{ type: "text", text: "Join us for an evening." }] }],
  date: "2026-11-14",
  startTime: "6:30 PM",
  endTime: "9:00 PM",
  programId: null,
  venue: "Community Centre",
  address: "Full address shared when you register",
  schedule: [{ time: "6:30 PM", item: "Welcome" }, { item: "Main session" }],
  imageId: "working-food-prep",
});

export const popup = () => ({
  ...base,
  id: "events-autumn-2026",
  key: "events-autumn-2026",
  heading: "New events are open for registration.",
  highlight: "registration.",
  body: "Find something near you and save your place.",
  imageId: "working-food-prep",
  cta: { label: "Explore events", href: "/media/events" },
  dismissLabel: "Maybe later",
  delayMs: 6000,
  frequency: "session",
  excludePaths: ["/contact", "/privacy"],
});

export const media = () => ({
  ...base,
  id: "working-relief-packing",
  kind: "image",
  alt: "Two volunteers packing supplies into cardboard boxes",
  focal: "50% 40%",
});

export const settings = () => ({
  ...base,
  id: "site-settings",
  general: { shortName: "RBB", name: "Rising Beyond Borders", summary: "A non-profit." },
  contact: { methods: [] },
  social: [{ platform: "instagram", url: "https://www.instagram.com/rbb" }],
  seo: { description: "Rising Beyond Borders is a non-profit." },
  engagement: {
    announcementBar: { enabled: true, intervalMs: 5000 },
    popup: { enabled: true },
    storyStrip: { enabled: true },
  },
});

/* Settings as stored before branding, analytics, donations and features
   were retired (2026-10-13) — still valid, so existing records and
   published snapshots keep working. */
export const legacySettings = () => ({
  ...settings(),
  branding: {},
  analytics: { googleAnalyticsId: "G-ABC1234" },
  donations: { form: donationForm(), closing: { heading: "Every contribution helps.", buttonLabel: "Donate" } },
  features: { themeSwitcher: false },
});
