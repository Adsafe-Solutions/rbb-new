import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiRequestError } from "../../api";
import { Alert, Button, Checkbox, Dialog, EmptyState, FileText, FormField, Input, PageContainer, PageHeader, Panel, Select, Spinner, Textarea, Trash2, useToast } from "../../design-system";
import { ItemList } from "../../blocks/fields";
import { navigate } from "../../router";
import type { PageProps } from "../../routes";
import { formsApi, type FormDefinitionData, type FormFieldDefinition, type FormListItem } from "../../forms/client";
import { FILE_TYPE_NAMES, TYPE_LABELS, builderProblems, cleanForm, isMarketingField, isSystemField, marketingField, newField, retype, typesFor } from "../../forms/builder";
import styles from "../../content/content.module.css";

/* /forms/:id — one website form (owners only). Its words, and its fields
   in order: each a label, a type, required or not, optional help and
   placeholder, options for a dropdown. Name and Email stay (replies need
   them). Saving puts the form on the website AT ONCE; a built-in form can
   be reset to the website's own, a career form deleted. */

export default function FormEditorPage({ params }: PageProps) {
  const id = params.id ?? "";
  const { toast } = useToast();
  const [view, setView] = useState<FormListItem | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<FormDefinitionData | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<{ message: string; fields: Map<string, string> } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const load = useCallback(async () => {
    try {
      const v = await formsApi.get(id);
      setView(v);
      setDraft(structuredClone(v.definition));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [id]);
  useEffect(() => void load(), [load]);

  const dirty = useMemo(() => Boolean(view && draft && (!view.saved || JSON.stringify(cleanForm(draft)) !== JSON.stringify(cleanForm(view.definition)))), [view, draft]);
  if (failed) return <PageContainer width="narrow"><EmptyState icon={FileText} title="This form could not be loaded" description="It may not exist, or its Careers role may have been removed." actions={<Button onClick={() => navigate("/forms")}>Back to Forms</Button>} /></PageContainer>;
  if (!view || !draft) return <PageContainer width="narrow"><Spinner label="Loading the form" /></PageContainer>;

  const set = (changes: Partial<FormDefinitionData>) => setDraft((d) => (d ? { ...d, ...changes } : d));
  const local = builderProblems(draft);
  const err = (path: string) => problem?.fields.get(path);
  const fieldErr = (i: number) => [...(problem?.fields.entries() ?? [])].filter(([p]) => p.startsWith(`fields.${i}.`)).map(([, m]) => m).join(" ");
  const types = typesFor(draft.kind);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setProblem(null);
    try {
      const result = await formsApi.save(id, cleanForm(draft));
      setView(result.form);
      setDraft(structuredClone(result.form.definition));
      toast({ title: "Form saved — live on the website", description: result.publishedVersion ? `Website version ${result.publishedVersion}.` : "It goes live with the website's first publication.", tone: "success" });
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 400) setProblem({ message: "Some parts of the form need attention.", fields: new Map(caught.details.map((d) => [d.path.replace(/^body\./, ""), d.message])) });
      else setProblem({ message: caught instanceof Error ? caught.message : "The form could not be saved.", fields: new Map() });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setConfirmRemove(false);
    try {
      await formsApi.remove(id);
      toast({ title: draft?.kind === "career" ? "Application form deleted" : "Form reset to the website's own", tone: "success" });
      navigate("/forms");
    } catch (caught) {
      setProblem({ message: caught instanceof Error ? caught.message : "It could not be changed.", fields: new Map() });
    }
  }

  const fieldEditor = (field: FormFieldDefinition, setField: (f: FormFieldDefinition) => void, i: number) => {
    const system = isSystemField(field.id);
    const marketing = isMarketingField(field.id);
    return (
      <div className={styles.fields}>
        <FormField label="Label" required error={err(`fields.${i}.label`)}>
          <Input maxLength={120} value={field.label} onChange={(e) => setField({ ...field, label: e.target.value })} />
        </FormField>
        <FormField label="Type" helper={system ? "Needed for replies: its type cannot change." : marketing ? "The marketing emails choice (Audience): always a checkbox, never required." : undefined}>
          <Select disabled={system || marketing} options={types.map((t) => ({ value: t, label: TYPE_LABELS[t] }))} value={field.type} onChange={(e) => setField(retype(field, e.target.value as FormFieldDefinition["type"]))} />
        </FormField>
        <Checkbox label="Required" checked={!marketing && (system || field.required)} disabled={system || marketing} onChange={(e) => setField({ ...field, required: e.target.checked })} />
        {field.type === "checkbox" && (
          <Checkbox label="Ticked when the form opens" checked={Boolean(field.defaultChecked)} onChange={(e) => setField({ ...field, defaultChecked: e.target.checked || undefined })} />
        )}
        {marketing && field.defaultChecked && <p className={styles.muted}>Ticked by default (owner decision). Note: a pre-ticked box is generally not valid consent for marketing emails under UK/EU or Indian law.</p>}
        <FormField label="Help text" helper="Optional. Shown under the label.">
          <Input maxLength={300} value={field.help ?? ""} onChange={(e) => setField({ ...field, help: e.target.value || undefined })} />
        </FormField>
        {!["checkbox", "select", "file"].includes(field.type) && (
          <FormField label="Placeholder" helper="Optional. Shown inside the empty box.">
            <Input maxLength={120} value={field.placeholder ?? ""} onChange={(e) => setField({ ...field, placeholder: e.target.value || undefined })} />
          </FormField>
        )}
        {field.type === "select" && (
          <FormField label="Options" required helper="One per line, in order." error={err(`fields.${i}.options`)}>
            <Textarea rows={5} value={(field.options ?? []).join("\n")} onChange={(e) => setField({ ...field, options: e.target.value.split("\n") })} />
          </FormField>
        )}
        {field.type === "file" && <p className={styles.muted}>Visitors attach one {FILE_TYPE_NAMES} file, up to 4 MB. Files are private: owners open them from Form submissions.</p>}
        <p className={styles.muted}>Field id: {field.id}</p>
        {fieldErr(i) && <p role="alert" style={{ color: "var(--color-danger-fg)", margin: 0 }}>{fieldErr(i)}</p>}
      </div>
    );
  };

  return (
    <PageContainer width="narrow">
      <PageHeader title={draft.title || "Form"} description={view.saved ? "Saving puts your changes on the website at once." : draft.kind === "career" ? "A new application form for this role. Saving puts it on the Careers page at once." : "The website's built-in form. Saving puts your version on the website at once."} />
      {problem && (
        <Alert tone="danger" role="alert" className={styles.notice}>
          {problem.message}
          {problem.fields.size > 0 && (
            <ul>
              {[...problem.fields.entries()].slice(0, 8).map(([path, message]) => (
                <li key={path}>
                  {path}: {message}
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}
      <div className={styles.sections}>
        <Panel title="Wording" as="h2">
          <div className={styles.fields}>
            <FormField label="Name in the admin" required error={err("title")}>
              <Input maxLength={120} value={draft.title} onChange={(e) => set({ title: e.target.value })} />
            </FormField>
            <FormField label="Heading" required error={err("heading")}>
              <Input maxLength={160} value={draft.heading} onChange={(e) => set({ heading: e.target.value })} />
            </FormField>
            <FormField label="Introduction" helper="Optional. Shown under the heading." error={err("intro")}>
              <Textarea rows={2} maxLength={600} value={draft.intro ?? ""} onChange={(e) => set({ intro: e.target.value || undefined })} />
            </FormField>
            <FormField label="Button text" required error={err("submitLabel")}>
              <Input maxLength={40} value={draft.submitLabel} onChange={(e) => set({ submitLabel: e.target.value })} />
            </FormField>
            <FormField label="Message after sending" required error={err("successMessage")}>
              <Textarea rows={2} maxLength={300} value={draft.successMessage} onChange={(e) => set({ successMessage: e.target.value })} />
            </FormField>
            <FormField label="Message if sending fails" required error={err("errorMessage")}>
              <Textarea rows={2} maxLength={300} value={draft.errorMessage} onChange={(e) => set({ errorMessage: e.target.value })} />
            </FormField>
          </div>
        </Panel>
        <Panel title="Fields" as="h2" description="In the order the website shows them. Name and Email stay on every form.">
          <div className={styles.fields}>
            <ItemList
              label="Fields"
              items={draft.fields}
              max={25}
              disabled={saving}
              error={err("fields")}
              itemLabel={(i) => draft.fields[i]?.label || `Field ${i + 1}`}
              addLabel="Add a field"
              onChange={(fields) => set({ fields })}
              make={() => newField("text", draft.fields)}
              render={fieldEditor}
            />
            {!draft.fields.some((f) => isMarketingField(f.id)) && (
              <div>
                <Button size="sm" onClick={() => set({ fields: [...draft.fields, marketingField()] })}>
                  Restore marketing checkbox
                </Button>
              </div>
            )}
            {local.length > 0 && (
              <Alert tone="warning">
                <ul style={{ margin: 0 }}>
                  {local.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </Alert>
            )}
          </div>
        </Panel>
      </div>
      <div className={styles.saveBar} data-dirty={dirty || undefined}>
        <span className={styles.saveState} aria-live="polite">
          {saving ? "Saving…" : dirty ? "Unsaved changes — saving puts them live" : "Saved and live"}
        </span>
        <span className={styles.saveActions}>
          {view.saved && (
            <Button variant="ghost" leadingIcon={<Trash2 />} onClick={() => setConfirmRemove(true)}>
              {draft.kind === "career" ? "Delete form" : "Reset to the website's own"}
            </Button>
          )}
          <Button variant="ghost" disabled={!dirty || saving} onClick={() => (setDraft(structuredClone(view.definition)), setProblem(null))}>
            Discard
          </Button>
          <Button variant="primary" loading={saving} disabled={!dirty || local.length > 0} onClick={save}>
            Save and publish
          </Button>
        </span>
      </div>
      <Dialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        size="sm"
        title={draft.kind === "career" ? "Delete this application form?" : "Reset to the website's own form?"}
        description={draft.kind === "career" ? "The role stays on the Careers page, without an Apply form. Submissions already received are kept. This is live at once." : "The website shows its built-in form again, at once. Submissions already received are kept."}
        footer={
          <>
            <Button onClick={() => setConfirmRemove(false)}>Cancel</Button>
            <Button variant="destructive" onClick={remove}>
              {draft.kind === "career" ? "Delete" : "Reset"}
            </Button>
          </>
        }
      />
    </PageContainer>
  );
}
