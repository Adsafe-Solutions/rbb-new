import { HeartHandshake } from "../../design-system";
import { appealsApi, formatDate, type Appeal } from "../../content/client";
import { ContentListPage } from "../../content/ListPage";

/* Appeals: emergency appeals, campaigns and special appeals, managed here once the first is
   created (until then the website keeps its own). */
export default function AppealsPage() {
  return (
    <ContentListPage<Appeal>
      api={appealsApi}
      base="appeals"
      kind="appeal"
      plural="Appeals"
      description="Emergency appeals, campaigns and special appeals. Givebutter takes the donations; published appeals go live when an owner publishes."
      icon={HeartHandshake}
      emptyDescription="Create an appeal for an emergency response, a campaign or a special appeal. Once the first appeal exists here, the website's appeals are managed from this list."
      statusColumn
      dateSortLabel="By publish date"
      columns={[
        { label: "Slug", cell: (v) => <code>{v.record.slug}</code> },
        { label: "Givebutter campaign", cell: (v) => v.record.donation?.checkout?.campaignId ?? "Site form" },
        { label: "Updated", cell: (v) => formatDate(v.updatedAt) },
        { label: "Published", cell: (v) => formatDate(v.record.publishedAt) },
      ]}
    />
  );
}
