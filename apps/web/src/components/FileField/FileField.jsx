import { useRef, useState } from "react";
import { CONTROL } from "../TextInput/TextInput.jsx";
import { cx } from "../../lib/cx.js";

/* A file for a career application (2026-10-13): chosen, then uploaded at
   once to the form's upload address (the API — POST …/files?field=<id>,
   the file's bytes, its name in X-File-Name). The field's value is the
   upload's id, which the form sends; nothing else about the file is kept
   in the page. PDF or Word, up to 4 MB — the API checks again, by the
   file's contents. Status changes are announced (aria-live). */
export default function FileField({ id, field, value, onChange, disabled, copy, describedBy, invalid }) {
  const input = useRef(null);
  const [state, setState] = useState({ status: value ? "done" : "idle", name: null, message: null });
  const t = copy.upload;

  async function choose(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (field.maxBytes && file.size > field.maxBytes) {
      onChange(field.name, "");
      setState({ status: "error", name: null, message: t.tooBig });
      return;
    }
    if (!field.uploadEndpoint) {
      setState({ status: "error", name: null, message: t.failed });
      return;
    }
    setState({ status: "uploading", name: file.name, message: null });
    onChange(field.name, "");
    try {
      const response = await fetch(`${field.uploadEndpoint}?field=${encodeURIComponent(field.name)}`, {
        method: "POST",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
        credentials: "omit",
        signal: AbortSignal.timeout(60000),
      });
      if (!response.ok) {
        const message = response.status === 415 ? t.wrongType : response.status === 413 ? t.tooBig : response.status === 429 ? t.rateLimited : t.failed;
        setState({ status: "error", name: null, message });
        return;
      }
      const { data } = await response.json();
      onChange(field.name, data.id);
      setState({ status: "done", name: data.name, message: null });
    } catch {
      setState({ status: "error", name: null, message: t.failed });
    }
  }

  const remove = () => {
    onChange(field.name, "");
    setState({ status: "idle", name: null, message: null });
  };

  return (
    <div className="grid gap-2">
      <input
        ref={input}
        id={id}
        type="file"
        accept={field.accept}
        className="sr-only"
        disabled={disabled || state.status === "uploading"}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        onChange={choose}
      />
      <div className={cx(CONTROL, "flex flex-wrap items-center gap-3")}>
        <button type="button" className="rounded-lg border-2 border-trust-blue px-3 py-1.5 font-bold" disabled={disabled || state.status === "uploading"} onClick={() => input.current?.click()}>
          {state.status === "done" ? t.replace : t.choose}
        </button>
        <span aria-live="polite" className="text-copy">
          {state.status === "uploading" ? `${t.uploading} ${state.name}` : state.status === "done" ? `${t.uploaded}: ${state.name ?? ""}` : t.types}
        </span>
        {state.status === "done" && (
          <button type="button" className="ml-auto underline" disabled={disabled} onClick={remove}>
            {t.remove}
          </button>
        )}
      </div>
      {state.message && (
        <p role="alert" className="text-[15px] text-alert">
          {state.message}
        </p>
      )}
    </div>
  );
}
