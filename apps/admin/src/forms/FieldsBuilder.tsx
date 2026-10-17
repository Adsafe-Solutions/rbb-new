import { useId } from "react";
import { Alert, Button, Checkbox, CircleDot, ChevronDown, FormField, Globe, Hash, CalendarDays, Input, ListChecks, Mail, Paperclip, Phone, Select, SquareCheck, TextAlignStart, Textarea, Type, UserRound, type IconComponent } from "../design-system";
import { ItemList } from "../blocks/fields";
import type { FormFieldDefinition } from "./client";
import { FILE_TYPE_NAMES, TYPE_LABELS, builderProblems, duplicateField, hasPlaceholder, isMarketingField, isSystemField, marketingField, paletteFor, retype, typesFor, type BuilderKind } from "./builder";
import { hasOptions } from "@rbb/content-schema/form-defaults";
import styles from "../content/content.module.css";
import local from "./forms.module.css";

/* A form's questions, in order — shared by Admin → Forms (website forms)
   and an event's registration form. Each field: its label, type (only the
   types this form may use), required or not, help, a placeholder where the
   type has one, options for every choice type, "ticked when the form
   opens" for a checkbox, the smallest and largest answer for a number.
   Name and Email stay (replies and confirmations need them) and so does
   the marketing checkbox; "Add a question" adds a field ready to word.
   `errors` are the API's messages RELATIVE to this list (builder.ts
   errorsUnder): "" for the list, "3.label" for field 4's label. */

const MAX_FIELDS = 25;
const ICONS: Record<string, IconComponent> = { name: UserRound, email: Mail, phone: Phone, text: Type, textarea: TextAlignStart, radio: CircleDot, checkboxes: ListChecks, select: ChevronDown, number: Hash, date: CalendarDays, country: Globe, agreement: SquareCheck, file: Paperclip };
/* A typed whole number, or none when the box is empty. */
const wholeOrNone = (value: string) => (value.trim() === "" || !Number.isFinite(Number(value)) ? undefined : Math.trunc(Number(value)));
/* What each field's own inputs show; the rest is listed under the field. */
const INLINE = new Set(["label", "options", "min", "max"]);

export function FieldsBuilder({ fields, onChange, kind, disabled, errors = new Map() }: { fields: FormFieldDefinition[]; onChange: (fields: FormFieldDefinition[]) => void; kind: BuilderKind; disabled: boolean; errors?: ReadonlyMap<string, string> }) {
  const types = typesFor(kind);
  const problems = builderProblems({ kind, fields });
  const err = (path: string) => errors.get(path);
  const fieldErr = (i: number) => [...errors.entries()].filter(([p]) => p.startsWith(`${i}.`) && !INLINE.has(p.slice(`${i}.`.length))).map(([, m]) => m).join(" ");
  const full = fields.length >= MAX_FIELDS;
  const paletteId = useId();

  const fieldEditor = (field: FormFieldDefinition, setField: (f: FormFieldDefinition) => void, i: number) => {
    const system = isSystemField(field.id);
    const marketing = isMarketingField(field.id);
    /* A type this form may not use (a file field on an event) stays listed, so the select shows the truth. */
    const options = (types.includes(field.type) ? types : [...types, field.type]).map((t) => ({ value: t, label: TYPE_LABELS[t] }));
    return (
      <div className={styles.fields}>
        <FormField label="Label" required disabled={disabled} error={err(`${i}.label`)}>
          <Input maxLength={120} value={field.label} onChange={(e) => setField({ ...field, label: e.target.value })} />
        </FormField>
        <FormField label="Type" disabled={disabled} helper={system ? "Needed for replies: its type cannot change." : marketing ? "The marketing emails choice (Audience): always a checkbox, never required." : undefined}>
          <Select disabled={disabled || system || marketing} options={options} value={field.type} onChange={(e) => setField(retype(field, e.target.value as FormFieldDefinition["type"]))} />
        </FormField>
        <Checkbox label="Required" checked={!marketing && (system || field.required)} disabled={disabled || system || marketing} onChange={(e) => setField({ ...field, required: e.target.checked })} />
        {field.type === "checkbox" && <Checkbox label="Ticked when the form opens" checked={Boolean(field.defaultChecked)} disabled={disabled} onChange={(e) => setField({ ...field, defaultChecked: e.target.checked || undefined })} />}
        {marketing && field.defaultChecked && <p className={styles.muted}>Ticked by default (owner decision). Note: a pre-ticked box is generally not valid consent for marketing emails under UK/EU or Indian law.</p>}
        <FormField label="Help text" helper="Optional. Shown under the label." disabled={disabled}>
          <Input maxLength={300} value={field.help ?? ""} onChange={(e) => setField({ ...field, help: e.target.value || undefined })} />
        </FormField>
        {hasPlaceholder(field.type) && (
          <FormField label="Placeholder" helper="Optional. Shown inside the empty box." disabled={disabled}>
            <Input maxLength={120} value={field.placeholder ?? ""} onChange={(e) => setField({ ...field, placeholder: e.target.value || undefined })} />
          </FormField>
        )}
        {hasOptions(field.type) && (
          <FormField label="Options" required helper={field.type === "checkboxes" ? "One per line, in order. Visitors can tick any number of them." : "One per line, in order. Visitors choose one."} disabled={disabled} error={err(`${i}.options`)}>
            <Textarea rows={5} value={(field.options ?? []).join("\n")} onChange={(e) => setField({ ...field, options: e.target.value.split("\n") })} />
          </FormField>
        )}
        {field.type === "number" && (
          <div className={styles.row}>
            <FormField label="Smallest answer" helper="Optional. A whole number." disabled={disabled} error={err(`${i}.min`)}>
              <Input type="number" step={1} value={field.min ?? ""} onChange={(e) => setField({ ...field, min: wholeOrNone(e.target.value) })} />
            </FormField>
            <FormField label="Largest answer" helper="Optional. A whole number." disabled={disabled} error={err(`${i}.max`)}>
              <Input type="number" step={1} value={field.max ?? ""} onChange={(e) => setField({ ...field, max: wholeOrNone(e.target.value) })} />
            </FormField>
          </div>
        )}
        {field.type === "file" && <p className={styles.muted}>Visitors attach one {FILE_TYPE_NAMES} file, up to 4 MB. Files are private: owners open them from Form submissions.</p>}
        <p className={styles.muted}>Field id: {field.id}</p>
        {fieldErr(i) && <p role="alert" style={{ color: "var(--color-danger-fg)", margin: 0 }}>{fieldErr(i)}</p>}
      </div>
    );
  };

  return (
    <div className={styles.fields}>
      <ItemList
        label="Fields"
        items={fields}
        max={MAX_FIELDS}
        disabled={disabled}
        error={err("")}
        itemLabel={(i) => fields[i]?.label || `Field ${i + 1}`}
        onChange={onChange}
        duplicate={(field, all) => duplicateField(field, all)}
        render={fieldEditor}
      />
      <div role="group" aria-labelledby={paletteId} className={local.palette}>
        <span id={paletteId} className={local.paletteLabel}>
          Add a question
        </span>
        {paletteFor(kind).map((p) => {
          const Icon = ICONS[p.key];
          return (
            <Button key={p.key} size="sm" leadingIcon={Icon && <Icon />} disabled={disabled || full} onClick={() => onChange([...fields, p.make(fields)])}>
              {p.name}
            </Button>
          );
        })}
        {!fields.some((f) => isMarketingField(f.id)) && (
          <Button size="sm" disabled={disabled || full} onClick={() => onChange([...fields, marketingField()])}>
            Restore marketing checkbox
          </Button>
        )}
      </div>
      {full && <p className={styles.muted}>A form has at most {MAX_FIELDS} fields.</p>}
      {problems.length > 0 && (
        <Alert tone="warning">
          <ul style={{ margin: 0 }}>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  );
}
