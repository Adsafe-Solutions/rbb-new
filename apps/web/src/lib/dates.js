/* A content date ("2026-03-14") as the site prints it: "14 March 2026".

   Read as UTC and printed in UTC, so the pre-rendered page and the
   hydrated one agree whatever time zone the build machine or the visitor
   is in — a date-only string parsed as LOCAL time is the previous day
   anywhere west of Greenwich. */
export const formatDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
