import { forwardRef } from "react";
import { cx } from "../../lib/cx.js";

/* What happened to a submission, in words and an icon — never colour
   alone.

     submitting  polite live region: "Sending…"
     success     RBB's approved success text; takes focus, since the form
                 it replaces is gone
     error       RBB's approved error text, plus a verified alternative
                 route when one exists; an alert

   The text always comes from the form's config. Nothing here writes its
   own success message, promises a reply or a response time. */
const ICONS = {
  success: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z",
  error: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1 5h2v7h-2V7Zm0 9h2v2h-2v-2Z",
};

const SubmissionStatus = forwardRef(function SubmissionStatus({ state, message, alternative, alternativeLead }, ref) {
  if (state === "submitting") {
    return (
      <p role="status" className="font-medium text-graphite">
        {message}
      </p>
    );
  }
  if (state !== "success" && state !== "error") return null;

  const error = state === "error";
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={error ? "alert" : "status"}
      className={cx(
        "flex items-start gap-4 rounded-2xl border-2 bg-paper-white p-5 sm:p-6",
        error ? "border-alert" : "border-growth-green"
      )}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className={cx("mt-0.5 h-6 w-6 shrink-0 fill-current", error ? "text-alert" : "text-trust-blue")}
      >
        <path d={ICONS[state]} />
      </svg>
      <div className="min-w-0 text-bumble-ink">
        <p className="font-semibold">{message}</p>
        {error && alternative && (
          <p className="mt-2">
            {alternativeLead}{" "}
            <a href={alternative.href} className="break-words font-semibold text-trust-blue underline underline-offset-4">
              {alternative.label}
            </a>
          </p>
        )}
      </div>
    </div>
  );
});

export default SubmissionStatus;
