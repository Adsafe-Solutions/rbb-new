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
  branding: {},
  analytics: {},
  donations: {
    form: { frequencyOptions: { oneTime: true, monthly: false }, currency: "USD", presetAmounts: [25, 50], allowCustomAmount: true, minimumAmount: 1, maximumAmount: 10000 },
    closing: { heading: "Every contribution helps.", buttonLabel: "Donate" },
  },
  engagement: { announcementBar: { enabled: true, intervalMs: 5000 }, popup: { enabled: false }, storyStrip: { enabled: true } },
  features: { themeSwitcher: false },
});
