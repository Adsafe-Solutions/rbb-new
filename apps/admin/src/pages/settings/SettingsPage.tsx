import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiRequestError } from "../../api";
import { useCan } from "../../auth";
import { Alert, Button, Card, EmptyState, PageContainer, PageHeader, Settings, Spinner, Tabs, useToast } from "../../design-system";
import { publishApi, settingsApi, type PublishStatus, type SectionKey, type SettingsView, type SiteSettings } from "../../settings/client";
import { AnalyticsSection, BrandingSection, ContactSection, DonationsSection, GeneralSection, SeoSection, SocialSection, type SectionProps } from "./sections";
import { PublishPanel } from "./PublishPanel";
import styles from "./SettingsPage.module.css";

/* Site settings: edit the organization's public details, save them (a
   draft only the admin sees), and — owners — publish them to the website.
   The API is the authority on everything: permissions, validation and
   conflicts; this page shows what it says. There is no Footer or
   Navigation section: the content contract holds neither yet, so the
   footer and menus stay source-controlled in the website. */

type EditableKey = "general" | "branding" | "contact" | "social" | "seo" | "analytics" | "donations";
const SECTIONS: { id: EditableKey; label: string; description: string }[] = [
  { id: "general", label: "General", description: "The organization's name and summary." },
  { id: "branding", label: "Branding", description: "Logo and favicon, from the media library." },
  { id: "contact", label: "Contact", description: "How people reach the organization." },
  { id: "social", label: "Social", description: "The organization's social media accounts." },
  { id: "seo", label: "SEO", description: "Defaults for search results and link previews." },
  { id: "analytics", label: "Analytics", description: "Public measurement IDs." },
  { id: "donations", label: "Donations", description: "Default donation form settings." },
];

/* Empty optional values are absent, as the contract expects. */
function clean<K extends EditableKey>(key: K, value: SiteSettings[K]): SiteSettings[K] {
  const drop = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as T;
  if (key === "contact") {
    const c = value as SiteSettings["contact"];
    const office = c.office && Object.values(c.office).some((v) => typeof v === "string" && v.trim() !== "") ? drop(c.office) : undefined;
    return drop({ ...c, methods: c.methods.map((m) => drop(m)), office }) as SiteSettings[K];
  }
  if (key === "branding" || key === "analytics" || key === "seo") return drop(value as object) as SiteSettings[K];
  return value;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

type Load = { status: "loading" } | { status: "error" } | { status: "empty" } | { status: "ready"; view: SettingsView };

export default function SettingsPage() {
  const canWrite = useCan("settings:write");
  const { toast } = useToast();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [draft, setDraft] = useState<SiteSettings | null>(null);
  const [publish, setPublish] = useState<PublishStatus | null>(null);
  const [tab, setTab] = useState<EditableKey>("general");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<{ kind: "conflict" | "invalid" | "error"; message: string; fields: Map<string, string> } | null>(null);

  const reload = useCallback(async () => {
    setProblem(null);
    try {
      const [view, status] = await Promise.all([settingsApi.get(), publishApi.status()]);
      setPublish(status);
      if (!view) {
        setLoad({ status: "empty" });
        setDraft(null);
      } else {
        setLoad({ status: "ready", view });
        setDraft(structuredClone(view.settings));
      }
    } catch {
      setLoad({ status: "error" });
    }
  }, []);
  useEffect(() => void reload(), [reload]);

  const saved = load.status === "ready" ? load.view.settings : null;
  const dirty = useMemo(() => (saved && draft ? SECTIONS.filter((s) => !same(clean(s.id, draft[s.id]), saved[s.id])).map((s) => s.id) : []), [saved, draft]);

  // Leaving the page with unsaved edits asks first.
  useEffect(() => {
    if (!dirty.length) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty.length]);

  async function save() {
    if (load.status !== "ready" || !draft || !dirty.length) return;
    setSaving(true);
    setProblem(null);
    const changes = Object.fromEntries(dirty.map((k) => [k, clean(k, draft[k])])) as Partial<Pick<SiteSettings, SectionKey>>;
    try {
      const view = await settingsApi.update(load.view.revision, changes);
      setLoad({ status: "ready", view });
      setDraft(structuredClone(view.settings));
      setPublish(await publishApi.status());
      toast({ title: "Settings saved", description: canPublishNote(publish), tone: "success" });
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 409) setProblem({ kind: "conflict", message: caught.message, fields: new Map() });
      else if (caught instanceof ApiRequestError && caught.status === 400) {
        const fields = new Map(caught.details.map((d) => [d.path.replace(/^body\.changes\./, ""), d.message]));
        setProblem({ kind: "invalid", message: "Some settings need attention before they can be saved.", fields });
        const first = [...fields.keys()][0]?.split(".")[0] as EditableKey | undefined;
        if (first && SECTIONS.some((s) => s.id === first)) setTab(first);
      } else setProblem({ kind: "error", message: "The settings could not be saved. Try again.", fields: new Map() });
    } finally {
      setSaving(false);
    }
  }

  const header = <PageHeader title="Settings" description="The organization's public details. Saved changes stay private until an owner publishes them." />;

  if (load.status === "loading")
    return (
      <PageContainer width="narrow">
        {header}
        <Spinner label="Loading settings" />
      </PageContainer>
    );
  if (load.status === "error")
    return (
      <PageContainer width="narrow">
        {header}
        <Alert tone="danger" role="alert">
          The settings could not be loaded.{" "}
          <Button size="sm" onClick={reload}>
            Try again
          </Button>
        </Alert>
      </PageContainer>
    );
  if (load.status === "empty" || !draft)
    return (
      <PageContainer width="narrow">
        {header}
        <Card>
          <EmptyState icon={Settings} title="Site settings haven't been set up yet" description="An owner imports the website's current settings once, with the API's settings import command. After that they are edited here." />
        </Card>
      </PageContainer>
    );

  const sectionProps = <K extends EditableKey>(key: K): SectionProps<K> => ({
    value: draft[key],
    onChange: (value) => setDraft((d) => (d ? { ...d, [key]: value } : d)),
    readOnly: !canWrite,
    errorFor: (path) => problem?.fields.get(`${key}.${path}`),
  });
  const editors: Record<EditableKey, JSX.Element> = {
    general: <GeneralSection {...sectionProps("general")} />,
    branding: <BrandingSection {...sectionProps("branding")} />,
    contact: <ContactSection {...sectionProps("contact")} />,
    social: <SocialSection {...sectionProps("social")} />,
    seo: <SeoSection {...sectionProps("seo")} />,
    analytics: <AnalyticsSection {...sectionProps("analytics")} />,
    donations: <DonationsSection {...sectionProps("donations")} />,
  };

  return (
    <PageContainer width="narrow">
      {header}
      {publish && <PublishPanel status={publish} unsaved={dirty.length > 0} onPublished={reload} />}
      {!canWrite && (
        <Alert tone="info" className={styles.notice}>
          You can view these settings. Owners can change and publish them.
        </Alert>
      )}
      {problem && (
        <Alert tone={problem.kind === "conflict" ? "warning" : "danger"} role="alert" className={styles.notice} title={problem.kind === "conflict" ? "Settings changed elsewhere" : undefined}>
          {problem.message}
          {problem.kind === "conflict" && (
            <span className={styles.inlineAction}>
              <Button size="sm" onClick={reload}>
                Reload latest version
              </Button>
              <span className={styles.muted}> Your unsaved edits will be discarded.</span>
            </span>
          )}
        </Alert>
      )}
      <Tabs
        label="Settings sections"
        value={tab}
        onValueChange={(id) => setTab(id as EditableKey)}
        items={SECTIONS.map((s) => ({
          id: s.id,
          label: (
            <>
              {s.label}
              {dirty.includes(s.id) && (
                <span className={styles.dirtyDot} aria-label="(unsaved changes)">
                  •
                </span>
              )}
            </>
          ),
          content: (
            <section aria-label={s.label} className={styles.section}>
              <p className={styles.sectionDescription}>{s.description}</p>
              {editors[s.id]}
            </section>
          ),
        }))}
      />
      {canWrite && (
        <div className={styles.saveBar} data-dirty={dirty.length > 0 || undefined}>
          <span className={styles.saveState} aria-live="polite">
            {saving ? "Saving…" : dirty.length ? `Unsaved changes in ${dirty.map((d) => SECTIONS.find((s) => s.id === d)!.label).join(", ")}` : `All changes saved${load.view.updatedBy ? ` · last by ${load.view.updatedBy.isYou ? "you" : load.view.updatedBy.name}` : ""}`}
          </span>
          <span className={styles.saveActions}>
            <Button variant="ghost" disabled={!dirty.length || saving} onClick={() => (setDraft(structuredClone(load.view.settings)), setProblem(null))}>
              Discard
            </Button>
            <Button variant="primary" loading={saving} disabled={!dirty.length && !saving} onClick={save}>
              Save changes
            </Button>
          </span>
        </div>
      )}
    </PageContainer>
  );
}

const canPublishNote = (status: PublishStatus | null) => (status?.canPublish ? "Publish when you're ready for them to go live." : "An owner can now publish them.");
