/* Every email template (Document 21 §8): renders, escapes, carries a
   plain-text version, and makes no response-time promise. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acknowledgement,
  newsletterConfirmation,
  newsletterNotification,
  notification,
} from "../email/templates.mjs";

const meta = { reference: "RBB-TEST2345", submittedAt: "2026-09-24 10:00" };
const hostile = `<img src=x onerror=alert(1)>"&'`;
const data = {
  name: hostile,
  email: "a@example.org",
  organization: hostile,
  topic: "partner",
  message: `${hostile}\nline two`,
};

const ALL = {
  "contact notification": notification("contact", data, meta),
  "volunteer notification": notification("volunteer", data, meta),
  "partner notification": notification("partner", data, meta),
  "fundraise notification": notification("fundraise", data, meta),
  "contact acknowledgement": acknowledgement("contact", meta),
  "volunteer acknowledgement": acknowledgement("volunteer", meta),
  "partner acknowledgement": acknowledgement("partner", meta),
  "fundraise acknowledgement": acknowledgement("fundraise", meta),
  "newsletter confirmation": newsletterConfirmation(meta),
  "newsletter notification": newsletterNotification(data, meta),
};

for (const [name, t] of Object.entries(ALL)) {
  test(`${name}: html + text, branded, escaped, no promises`, () => {
    assert.ok(t.subject && t.html.startsWith("<!doctype html>") && t.text.length > 20);
    assert.ok(t.html.includes("Rising Beyond Borders") && t.html.includes("#10437C"));
    assert.ok(t.html.includes(meta.reference) && t.text.includes(meta.reference));
    assert.ok(!t.html.includes("<img src=x"), "visitor markup never raw");
    assert.ok(!/<|>|onerror/.test(t.subject), "subject carries no visitor input");
    assert.ok(
      !/within \d|\d+ (hours|days|business)|we will (reply|respond|get back)/i.test(
        t.html + t.text
      ),
      "no response-time promise"
    );
  });
}

test("partner notification shows the organization; contact shows the topic label", () => {
  assert.ok(
    ALL["partner notification"].html.includes("&lt;img src=x onerror=alert(1)&gt;")
  );
  assert.ok(ALL["contact notification"].html.includes("Partner With Us"));
});

test("newsletter confirmation shows a confirm button only when a confirm URL exists", () => {
  assert.ok(!newsletterConfirmation(meta).html.includes("Confirm your subscription"));
  assert.ok(
    newsletterConfirmation({
      ...meta,
      confirmUrl: "https://rbb.test.invalid/confirm?t=1",
    }).html.includes("Confirm your subscription")
  );
});
