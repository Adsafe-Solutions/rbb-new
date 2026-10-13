/* An id for an item in an editor's list, from its name ("East Africa" →
   "east-africa"), unique among the list's other items ("east-africa-2" …).
   Internal: the website shows the name, and nothing links to the id, so it
   follows the name. A name with no Latin letters or digits gets the
   fallback ("region", "passage"). Plain function, unit-tested. */
export function idFrom(name: string, others: readonly { id: string }[], fallback: string): string {
  const base = name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").slice(0, 100).replace(/^-+|-+$/g, "") || fallback;
  const taken = new Set(others.map((o) => o.id));
  let id = base;
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
  return id;
}
