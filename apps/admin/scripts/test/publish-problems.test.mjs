import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describePublishProblem, publishProblemLine } from "../../src/settings/publishProblems.ts";

/* Website-publish problems (settings/publishProblems.ts): each one says
   WHERE in the admin to fix it, with a link — not a path into the
   snapshot. The real messages met while entering content are the cases. */

const at = (raw) => {
  const p = describePublishProblem(raw);
  return [p.where, p.href, p.message];
};

test("a story the Impact page names: the Impact page, the block, the message unchanged", () => {
  assert.deepEqual(at('snapshot.content.impact.sections.5.data.storyIds.0: refers to story "classroom-books", which is not published'), ["Impact page · block 6", "/impact", 'refers to story "classroom-books", which is not published']);
  assert.deepEqual(at('content.impact.sections: refers to story "sewing", which is not published'), ["Impact page", "/impact", 'refers to story "sewing", which is not published']);
});

test("two featured stories: the Stories list", () => {
  assert.deepEqual(at("snapshot.content.stories: 2 stories are featured; one at most"), ["Stories", "/stories", "2 stories are featured; one at most"]);
});

test("a policy: its own editor; Get Involved: its page; the team by address; a list item by position", () => {
  assert.deepEqual(at("content.policies.privacy: contains working-placeholder text (confirmation placeholder)"), ["Policies · Privacy Policy", "/policies/privacy", "contains working-placeholder text (confirmation placeholder)"]);
  assert.deepEqual(at("snapshot.content.getInvolved.travel.sections: needs a paragraph"), ["Get Involved · Travel With Us page", "/get-involved/travel", "needs a paragraph"]);
  assert.deepEqual(at("content.team.aquib-yazdani.media.02914885: refers to an image that is missing, not ready or deleted"), ["Team · aquib-yazdani", "/team", "refers to an image that is missing, not ready or deleted"]);
  assert.deepEqual(at("snapshot.content.projects.2.storyId: refers to a story that is not published"), ["Projects · item 3", "/projects", "refers to a story that is not published"]);
  assert.deepEqual(at("snapshot.content.homepage.sections.0.data.slides: needs a slide"), ["Homepage · block 1", "/homepage", "needs a slide"]);
});

test("a scheduled publication: the record itself, or the page", () => {
  assert.deepEqual(at("schedule.Team.3f2c-9a: no longer matches the approved revision it was scheduled for"), ["Team · scheduled publication", "/team/3f2c-9a", "no longer matches the approved revision it was scheduled for"]);
  assert.deepEqual(at("schedule.Privacy Policy.privacy: no longer matches"), ["Privacy Policy · scheduled publication", "/policies/privacy", "no longer matches"]);
  assert.deepEqual(at("schedule.Homepage.homepage: no longer matches"), ["Homepage · scheduled publication", "/homepage", "no longer matches"]);
});

test("settings and media", () => {
  assert.deepEqual(at("snapshot.settings.contact.methods.0.value: looks like a credential and cannot be published"), ["Settings", "/settings", "looks like a credential and cannot be published"]);
  assert.deepEqual(at("settings.seo.description: is required"), ["Settings", "/settings", "is required"]);
});

test("anything unrecognised still shows — as before, without a link", () => {
  const p = describePublishProblem("snapshot.version: must be a positive integer");
  assert.equal(p.where, null);
  assert.equal(p.href, null);
  assert.equal(p.message, "version: must be a positive integer");
  assert.equal(describePublishProblem("Something odd").message, "Something odd");
});

test("every link is a page the admin has", () => {
  const routes = readFileSync(new URL("../../src/routes.tsx", import.meta.url), "utf8");
  const paths = new Set([...routes.matchAll(/path: "([^"]+)"/g)].map((m) => m[1]));
  const samples = ["content.news.0: x", "content.blogs.0: x", "content.events.0: x", "content.appeals.0: x", "content.generalDonation: x", "content.about: x", "content.programs.0: x", "content.metrics.0: x", "content.transparency: x", "content.reports.0: x", "content.careers: x", "content.announcementBar: x", "content.popup: x", "content.storyStrip: x", "media.x: y", "content.getInvolved.hub: x"];
  for (const s of samples) {
    const href = describePublishProblem(s).href;
    const route = [...paths].find((p) => p === href || new RegExp(`^${p.replace(/:[a-z]+/g, "[^/]+")}$`).test(href));
    assert.ok(route, `${s} → ${href} is an admin route`);
  }
});

test("the publish panel, the publish dialog and a refused schedule all show problems this way", () => {
  const panel = readFileSync(new URL("../../src/pages/settings/PublishPanel.tsx", import.meta.url), "utf8");
  const workflow = readFileSync(new URL("../../src/content/workflow.tsx", import.meta.url), "utf8");
  assert.match(panel, /<PublishProblemText problem=\{b\} \/>/);
  assert.match(panel, /publishProblemLine\(`\$\{d\.path\}: \$\{d\.message\}`\)/, "a refused publish's message names the place too");
  assert.equal((workflow.match(/<PublishProblemText problem=/g) ?? []).length, 2);
  assert.doesNotMatch(panel + workflow, /replace\(\/\^\(snapshot\\\.\|settings\\\.\)\+\/, ""\)/, "no raw path text left");
});

test("as one line, for a message that cannot hold a link", () => {
  assert.equal(publishProblemLine("snapshot.content.stories: 2 stories are featured; one at most"), "Stories — 2 stories are featured; one at most");
  assert.equal(publishProblemLine("snapshot.version: must be a positive integer"), "version: must be a positive integer");
});

test("an inherited object name in a path is not a page (no prototype lookups)", () => {
  for (const raw of ["content.constructor: x", "content.toString.0: x", "schedule.constructor.1: x", "content.policies.constructor: x", "content.getInvolved.__proto__: x"]) {
    const p = describePublishProblem(raw);
    assert.ok(p.where === null || !/undefined/.test(p.where), `${raw} → ${p.where}`);
    assert.ok(p.href === null || !/undefined|constructor|__proto__/.test(p.href), `${raw} → ${p.href}`);
  }
  assert.deepEqual(at("content.policies.constructor: x"), ["Policies · constructor", "/policies", "x"]);
});

test("the How We Work page (#7): the card, passage or header, and its editor", () => {
  assert.deepEqual(at("content.howWeWork.rows.2.heading: must not be empty"), ["How We Work page · passage 3", "/how-we-work", "must not be empty"]);
  assert.deepEqual(at("content.howWeWork.practices.items.0.icon: Invalid option"), ["How We Work page · card 1", "/how-we-work", "Invalid option"]);
  assert.deepEqual(at("content.howWeWork.heading: contains working-placeholder text"), ["How We Work page · page header", "/how-we-work", "contains working-placeholder text"]);
  assert.deepEqual(at("content.howWeWork.status: a snapshot holds published records only"), ["How We Work page", "/how-we-work", "a snapshot holds published records only"]);
  assert.deepEqual(at("schedule.How We Work page.how_we_work: no longer matches the approved revision"), ["How We Work page · scheduled publication", "/how-we-work", "no longer matches the approved revision"]);
});
