/* A valid SiteSettings record for tests. Neutral test values — not RBB's. */
export const settingsRecord = (orgId: string) => ({
  id: "site-settings",
  orgId,
  schemaVersion: 1 as const,
  status: "draft" as const,
  general: { shortName: "TEST", name: "Test Organization", summary: "A test organization." },
  contact: { methods: [] as unknown[] },
  social: [{ platform: "instagram", url: "https://www.instagram.com/test-organization" }],
  seo: { description: "Test Organization is a test organization." },
  engagement: { announcementBar: { enabled: true, intervalMs: 5000 }, popup: { enabled: false }, storyStrip: { enabled: true } },
});

/* A record as stored before branding, analytics, donations and features
   were retired (2026-10-13): those keys are still valid, never edited. */
export const legacySettingsRecord = (orgId: string) => ({
  ...settingsRecord(orgId),
  branding: {},
  analytics: { googleAnalyticsId: "G-ABC1234" },
  donations: {
    form: { frequencyOptions: { oneTime: true, monthly: false }, currency: "USD", presetAmounts: [25, 50], allowCustomAmount: true, minimumAmount: 1, maximumAmount: 10000 },
    closing: { heading: "Every contribution helps.", buttonLabel: "Donate" },
  },
  features: { themeSwitcher: false },
});
