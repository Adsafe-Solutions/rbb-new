import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, FileText, PageContainer, PageHeader, Plus, Table, TableBody, TableCell, TableHead, TableHeader, TableLoading, TableRow } from "../../design-system";
import { navigate } from "../../router";
import type { PageProps } from "../../routes";
import { formsApi, type FormListItem, type FormRole } from "../../forms/client";

/* /forms — the website's forms (owners only). Contact Us, Volunteer and
   Partner With Us are always here (the built-in form until saved); each
   open role on the Careers page takes applications — through its own
   form once saved here, else the standard application form (2026-10-17).
   Saving a form puts it on the website at once — no review. */

const when = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function FormsPage(_: PageProps) {
  const [state, setState] = useState<{ status: "loading" } | { status: "failed" } | { status: "ready"; forms: FormListItem[]; roles: FormRole[] }>({ status: "loading" });
  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const { forms, roles } = await formsApi.list();
      setState({ status: "ready", forms, roles });
    } catch {
      setState({ status: "failed" });
    }
  }, []);
  useEffect(() => void load(), [load]);

  if (state.status === "failed")
    return (
      <PageContainer>
        <PageHeader title="Forms" />
        <EmptyState bordered icon={FileText} title="The forms could not be loaded" description="Try again in a moment." actions={<Button onClick={load}>Try again</Button>} />
      </PageContainer>
    );

  const missing = state.status === "ready" ? state.roles.filter((r) => !r.hasForm) : [];
  return (
    <PageContainer>
      <PageHeader
        title="Forms"
        description="The forms on the website. Edit their fields and wording; a saved form is live on the website at once. Every open role on the Careers page takes applications with the standard form (name, email, CV, message); customise one to change its fields or wording."
      />
      <Table label="Website forms" loading={state.status === "loading"}>
        <TableHeader>
          <TableRow>
            <TableHead>Form</TableHead>
            <TableHead>Fields</TableHead>
            <TableHead>State</TableHead>
            <TableHead shrink>
              <span className="ds-visually-hidden">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.status === "loading" ? (
            <TableLoading colSpan={4} />
          ) : (
            state.forms.map((f) => (
              <TableRow key={f.definition.id}>
                <TableCell>
                  {f.definition.title}
                  {f.definition.kind === "career" && <Badge tone="neutral"> Careers</Badge>}
                </TableCell>
                <TableCell muted>{f.definition.fields.length}</TableCell>
                <TableCell muted>{f.saved ? `Saved ${f.updatedAt ? when.format(new Date(f.updatedAt)) : ""}` : "The website's built-in form"}</TableCell>
                <TableCell shrink>
                  <Button size="sm" onClick={() => navigate(`/forms/${f.definition.id}`)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {state.status === "ready" && (
        <section style={{ marginTop: "var(--space-6)" }} aria-label="Careers roles using the standard application form">
          <h2 style={{ fontSize: "var(--text-md, 1rem)", margin: "0 0 var(--space-2)" }}>Careers roles using the standard application form</h2>
          {missing.length === 0 ? (
            <p style={{ color: "var(--color-text-muted)", margin: 0 }}>{state.roles.length ? "Every open role has its own customised form." : "No open roles yet. Add roles on the Careers page and save it; they appear here."}</p>
          ) : (
            <ul style={{ display: "grid", gap: "var(--space-2)", margin: 0, padding: 0, listStyle: "none" }}>
              {missing.map((r) => (
                <li key={r.id} style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
                  <span>{r.title}</span>
                  <Button size="sm" leadingIcon={<Plus />} onClick={() => navigate(`/forms/${r.formId}`)}>
                    Customise form
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </PageContainer>
  );
}
