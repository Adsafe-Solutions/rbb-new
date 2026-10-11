import { CalendarDays } from "../../design-system";
import { eventsApi, formatDate, type Event } from "../../content/client";
import { ContentListPage } from "../../content/ListPage";

/* Events, managed here once the first is created. */
export default function EventsPage() {
  return (
    <ContentListPage<Event>
      api={eventsApi}
      base="events"
      kind="event"
      plural="Events"
      description="Events for the website. Published events go live when an owner publishes."
      icon={CalendarDays}
      emptyDescription="Create an event to list it on the website. Once created here, events on the website are managed from this list."
      columns={[
        { label: "Date", cell: (v) => `${formatDate(v.record.date)} · ${v.record.startTime}${v.record.timezone ? ` (${v.record.timezone})` : ""}` },
        { label: "Updated", cell: (v) => formatDate(v.updatedAt) },
      ]}
    />
  );
}
