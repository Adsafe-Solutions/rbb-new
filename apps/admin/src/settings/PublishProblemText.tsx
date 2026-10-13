import { followLink } from "../router";
import { describePublishProblem } from "./publishProblems";

/* One website-publish problem as the person fixing it needs it: where
   (a link to that page of the admin) and what (the API's message). See
   publishProblems.ts. A problem it does not recognise shows as before. */
export function PublishProblemText({ problem }: { problem: string }) {
  const p = describePublishProblem(problem);
  if (!p.where) return <>{p.message}</>;
  return (
    <>
      {p.href ? (
        <a href={p.href} onClick={(e) => followLink(e, p.href!)} data-testid="publish-problem-link">
          {p.where}
        </a>
      ) : (
        <strong>{p.where}</strong>
      )}
      {" — "}
      {p.message}
    </>
  );
}
