import assert from "node:assert/strict";

/* M14 over HTTP: the editorial workflow as the admin walks it — submit
   for review, then an owner approves (the next website publish takes it).
   `path` is a record's (/api/v1/programs/<id>) or a page's
   (/api/v1/homepage). Real requests; every step must succeed. */

type Send = (method: string, path: string, body?: unknown) => Promise<Response>;
type View = { record: { status: string; id?: string }; revision: number };

export async function approveOverHttp(send: Send, path: string): Promise<View> {
  const read = await send("GET", path);
  assert.equal(read.status, 200, `GET ${path}`);
  let view = ((await read.json()) as { data: View }).data;
  for (const [from, action] of [["draft", "submit"], ["submitted", "approve"]] as const) {
    if (view.record.status !== from) continue;
    const res = await send("POST", `${path}/${action}`, { revision: view.revision });
    assert.equal(res.status, 200, `${action} ${path}: ${res.status}`);
    view = ((await res.json()) as { data: View }).data;
  }
  assert.equal(view.record.status, "approved", `${path} approved`);
  return view;
}
