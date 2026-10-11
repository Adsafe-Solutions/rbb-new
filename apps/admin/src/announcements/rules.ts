/* The announcement bar editor's pure rules (M21), unit-tested under plain
   Node (scripts/test/announcements.test.mjs). The API enforces every one
   of them; these keep the editor from offering what it would refuse. */

export const MAX_MESSAGES = 10;
export const MAX_TEXT = 140;
export const MAX_LINK_LABEL = 40;

export interface MessageDraft {
  id: string;
  text: string;
  linkOn: boolean;
  label: string;
  href: string;
}

export interface MessagePayload {
  id: string;
  text: string;
  link?: { label: string; href: string };
}

/* A message's id: generated once, never shown, never edited. */
export const newMessageId = () => `m-${crypto.randomUUID().slice(0, 8)}`;
export const emptyMessage = (): MessageDraft => ({ id: newMessageId(), text: "", linkOn: false, label: "", href: "" });

export const draftOf = (items: MessagePayload[] | undefined): MessageDraft[] =>
  (items ?? []).map((i) => ({ id: i.id, text: i.text, linkOn: Boolean(i.link), label: i.link?.label ?? "", href: i.link?.href ?? "" }));

export const payloadOf = (drafts: MessageDraft[]): MessagePayload[] =>
  drafts.map((d) => ({ id: d.id, text: d.text.trim(), ...(d.linkOn && { link: { label: d.label.trim(), href: d.href.trim() } }) }));

/* A path on this site, without query or fragment — the contract's rule.
   Whether it is one of the website's pages is checked by its build. */
export const isSitePath = (href: string) => /^\/(?!\/)[^\s?#\\]*$/.test(href);

export function messageProblems(drafts: MessageDraft[]): Map<string, string> {
  const problems = new Map<string, string>();
  payloadOf(drafts).forEach((m, i) => {
    if (!m.text) problems.set(`items.${i}.text`, "A message is required.");
    if (m.link) {
      if (!m.link.label) problems.set(`items.${i}.link.label`, "Link text is required.");
      if (!isSitePath(m.link.href)) problems.set(`items.${i}.link.href`, "A page of this site, like /appeals or /media/events.");
    }
  });
  return problems;
}

/* The bar's display settings: seconds in the form, ms in the settings. */
export const secondsOf = (ms: number) => Math.round(ms / 1000);
export const intervalProblem = (seconds: number) => (Number.isInteger(seconds) && seconds >= 2 && seconds <= 30 ? null : "Between 2 and 30 seconds.");
