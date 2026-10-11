import type { PublishLock } from "../publishing/lock.ts";
import { z } from "zod";
import { Metric } from "@rbb/content-schema";
import type { AuditService } from "../audit/audit.ts";
import type { ContentStore } from "../content/repository.ts";
import { OrderedContentService } from "../content/ordered.ts";
import type { CollectionConfig } from "../content/service.ts";
import type { MediaStore } from "../media/repository.ts";

/* Impact figures (M11) — the headline figures (the content contract's
   Metric), an ORDERED content collection (content/ordered.ts), as the
   programs: drafts, published, archived; a unique key (`slug`, what every
   `stats` block names — the homepage's and the Impact page's alike, so a
   figure is written once); confirmed key changes once published; audit
   as metric.created, metric.updated, metric.archived and one
   metric.reordered per reorder; owner-only publishing.

   Editable: value, label, key, verification. The order is the
   collection's own operation (POST /api/v1/metrics/order). No media. */

const editable = Object.fromEntries(["value", "label", "slug", "verification"].map((f) => [f, z.unknown()]));

export const METRIC_COLLECTION: CollectionConfig<Metric> = {
  kind: "metric",
  contract: Metric,
  fields: editable,
  required: ["value", "label", "slug"],
  defaults: () => ({ order: 0, verification: "pending-review" }),
  rules: () => [],
  media: () => [],
  opaque: [],
};

export class MetricService extends OrderedContentService<Metric> {
  constructor(store: ContentStore<Metric>, media: MediaStore, audit: AuditService, options: { orgId: string; now?: () => Date; lock?: PublishLock }) {
    super(METRIC_COLLECTION, store, media, audit, { ...options, auditReorderOnce: true });
  }
}
