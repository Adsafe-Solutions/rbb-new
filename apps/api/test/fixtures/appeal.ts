/* A valid Appeal record (packages/content-schema) for tests only — never
   inserted anywhere but a disposable test database. */
export const TEST_ORG = "test-org";

export const appealRecord = (overrides: Record<string, unknown> = {}) => ({
  id: "test-appeal-01",
  orgId: TEST_ORG,
  schemaVersion: 1,
  status: "published",
  kind: "emergency",
  slug: "test-appeal-01",
  title: "Test Appeal",
  summary: "A record used only by the API's tests.",
  imageId: "test-image",
  sections: [
    {
      id: "situation",
      type: "statement",
      enabled: true,
      version: 1,
      data: { heading: "The situation", body: ["A paragraph."] },
    },
  ],
  ...overrides,
});
