import { useEffect, useState } from "react";
import { ApiRequestError } from "../../api";
import { useCan } from "../../auth";
import {
  Alert,
  Button,
  Copy,
  Dialog,
  FormField,
  IconButton,
  Input,
  Select,
  StatusBadge,
  Textarea,
  Trash2,
  X,
  useToast,
} from "../../design-system";
import { mediaApi, type Consent, type MediaItem, type MetadataChanges } from "../../media/client";
import { formatBytes } from "../../media/uploads";
import { typeLabel } from "./MediaTile";
import styles from "./MediaDetail.module.css";

const CONSENT_OPTIONS: { value: Consent; label: string }[] = [
  { value: "unknown", label: "Not recorded" },
  { value: "not-required", label: "Not needed — no identifiable people" },
  { value: "obtained", label: "Obtained from the people shown" },
  { value: "not-obtained", label: "Not obtained" },
];

const FIELDS = ["alt", "caption", "credit", "license", "consent"] as const;
type Draft = Pick<MediaItem, (typeof FIELDS)[number]>;
const draftOf = (media: MediaItem): Draft => ({ alt: media.alt, caption: media.caption, credit: media.credit, license: media.license, consent: media.consent });

const formatDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

interface MediaDetailProps {
  media: MediaItem;
  onClose: () => void;
  onChanged: (media: MediaItem) => void;
  onDeleted: (id: string) => void;
}

/* One file: preview, facts, and the editable details. Alt text comes
   first — it is what makes the image usable on the site. Nothing here is
   ever filled in automatically. */
export function MediaDetail({ media, onClose, onChanged, onDeleted }: MediaDetailProps) {
  const canEdit = useCan("media:write");
  const { toast } = useToast();
  const [draft, setDraft] = useState<Draft>(() => draftOf(media));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; conflict: boolean; usedBy?: string[] } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setDraft(draftOf(media));
    setError(null);
  }, [media.id, media.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const changes = Object.fromEntries(FIELDS.filter((f) => draft[f] !== media[f]).map((f) => [f, draft[f]])) as MetadataChanges;
  const dirty = Object.keys(changes).length > 0;
  const ready = media.status === "ready";

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await mediaApi.update(media.id, media.version, changes);
      onChanged(updated);
      toast({ title: "Details saved", tone: "success" });
    } catch (caught) {
      const conflict = caught instanceof ApiRequestError && caught.status === 409;
      setError({ conflict, message: conflict ? "Someone else changed this file since you opened it." : caught instanceof ApiRequestError && caught.status === 400 ? "Some details are too long or not valid." : "The details could not be saved. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  async function reload() {
    try {
      onChanged(await mediaApi.get(media.id));
    } catch {
      setError({ conflict: false, message: "The file could not be reloaded." });
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await mediaApi.remove(media.id);
      setConfirmDelete(false);
      onDeleted(media.id);
      toast({ title: "Media deleted", description: media.originalFilename });
    } catch (caught) {
      // M16: the API refuses to delete an image the website or approved content still uses, and says where.
      const usedBy = caught instanceof ApiRequestError && caught.status === 409 ? caught.details.filter((d) => d.path === "usedBy").map((d) => d.message) : [];
      setError(
        usedBy.length
          ? { conflict: false, message: "This file is still in use, so it was not deleted. Remove it from these first:", usedBy }
          : { conflict: false, message: caught instanceof ApiRequestError && caught.status === 409 ? caught.message : "The file could not be deleted. Please try again." }
      );
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${what} copied` });
    } catch {
      toast({ title: `The ${what.toLowerCase()} could not be copied`, tone: "warning" });
    }
  };

  return (
    <div className={styles.detail}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h2 className={styles.title}>{media.originalFilename}</h2>
          <p className={styles.subtitle}>
            {typeLabel(media.mimeType)} · {formatBytes(media.size)}
          </p>
        </div>
        <IconButton label="Close details" icon={<X />} onClick={onClose} />
      </header>

      <div className={styles.body}>
        <div className={styles.preview}>
          {ready && media.publicUrl ? (
            <img src={media.publicUrl} alt={draft.alt} width={media.width ?? undefined} height={media.height ?? undefined} />
          ) : (
            <StatusBadge status={media.status === "failed" ? "error" : "pending"} label={media.status === "failed" ? "Upload failed" : "Upload not finished"} />
          )}
        </div>

        {error && (
          <Alert tone="danger" role="alert">
            {error.message}
            {error.usedBy && (
              <ul className={styles.usedBy} aria-label="Where this file is used">
                {error.usedBy.map((where) => (
                  <li key={where}>{where}</li>
                ))}
              </ul>
            )}
            {error.conflict && (
              <span className={styles.inlineAction}>
                <Button size="sm" onClick={reload}>
                  Reload latest
                </Button>
              </span>
            )}
          </Alert>
        )}

        <dl className={styles.facts}>
          <div>
            <dt>Dimensions</dt>
            <dd>{media.width && media.height ? `${media.width} × ${media.height} px` : "—"}</dd>
          </div>
          <div>
            <dt>Uploaded</dt>
            <dd>{formatDate(media.createdAt)}</dd>
          </div>
          <div>
            <dt>Media ID</dt>
            <dd className={styles.copyRow}>
              <code className={styles.mono}>{media.id}</code>
              <IconButton size="sm" label="Copy media ID" icon={<Copy />} onClick={() => copy(media.id, "Media ID")} />
            </dd>
          </div>
          {ready && media.publicUrl && (
            <div>
              <dt>Public URL</dt>
              <dd className={styles.copyRow}>
                <a href={media.publicUrl} target="_blank" rel="noreferrer" className={styles.url}>
                  {media.publicUrl}
                </a>
                <IconButton size="sm" label="Copy public URL" icon={<Copy />} onClick={() => copy(media.publicUrl!, "Public URL")} />
              </dd>
            </div>
          )}
          {media.status === "failed" && media.failureReason && (
            <div>
              <dt>Reason</dt>
              <dd>{media.failureReason === "upload-aborted" ? "The upload was cancelled or interrupted." : media.failureReason === "abandoned" ? "The upload was never finished." : "The file was rejected when it was checked."}</dd>
            </div>
          )}
        </dl>

        {ready && (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              if (dirty && !saving) void save();
            }}
          >
            {!draft.alt.trim() && (
              <Alert tone="warning" title="Alt text missing">
                Describe what the image shows for people who can't see it. Without alt text, this image should only be used as decoration.
              </Alert>
            )}
            <FormField label="Alt text" helper="What the image shows, in a sentence. Up to 300 characters.">
              <Textarea rows={3} maxLength={300} value={draft.alt} onChange={(e) => setDraft({ ...draft, alt: e.target.value })} disabled={!canEdit} />
            </FormField>
            <FormField label="Caption" helper="Shown beside the image where a page uses captions.">
              <Textarea rows={2} maxLength={1000} value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} disabled={!canEdit} />
            </FormField>
            <FormField label="Credit" helper="The photographer or source, as it should be credited.">
              <Input maxLength={200} value={draft.credit} onChange={(e) => setDraft({ ...draft, credit: e.target.value })} disabled={!canEdit} />
            </FormField>
            <FormField label="License" helper="For example: owned by the organization, CC BY 4.0, or the stock licence.">
              <Input maxLength={200} value={draft.license} onChange={(e) => setDraft({ ...draft, license: e.target.value })} disabled={!canEdit} />
            </FormField>
            <FormField label="Consent" helper="For images of people: has their consent to publish been recorded?">
              <Select options={CONSENT_OPTIONS} value={draft.consent} onChange={(e) => setDraft({ ...draft, consent: e.target.value as Consent })} disabled={!canEdit} />
            </FormField>
            {draft.consent === "not-obtained" && (
              <Alert tone="warning">
                Don't publish images of identifiable people without their consent.
              </Alert>
            )}
          </form>
        )}
      </div>

      {canEdit && (
        <footer className={styles.footer}>
          <Button variant="ghost" leadingIcon={<Trash2 />} className={styles.delete} onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
          {ready && (
            <Button variant="primary" onClick={save} loading={saving} disabled={!dirty && !saving}>
              Save details
            </Button>
          )}
        </footer>
      )}

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        size="sm"
        title="Delete this file?"
        description={`“${media.originalFilename}” will be removed from the media library and from storage.${ready ? " A file the live website or approved content still uses is not deleted — you will be told where it is used." : ""}`}
        footer={
          <>
            <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" loading={deleting} onClick={remove}>
              Delete file
            </Button>
          </>
        }
      />
    </div>
  );
}

