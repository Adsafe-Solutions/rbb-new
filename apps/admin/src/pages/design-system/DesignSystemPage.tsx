import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  Alert,
  Avatar,
  Badge,
  Bell,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  COLOR_GROUPS,
  CONTRAST_PAIRS,
  Copy,
  Dialog,
  Ellipsis,
  EmptyState,
  FileText,
  FormField,
  IconButton,
  Inbox,
  Input,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  PageContainer,
  PageHeader,
  PageSection,
  Panel,
  Pencil,
  Plus,
  RADII,
  Radio,
  RadioGroup,
  Search,
  Select,
  Separator,
  setThemeMode,
  SHADOWS,
  Skeleton,
  SPACING,
  Spinner,
  STATUS_PRESENTATION,
  StatusBadge,
  Surface,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableLoading,
  TableRow,
  Tabs,
  Text,
  Textarea,
  Tooltip,
  Trash2,
  TYPE_ROLES,
  useToast,
  type Status,
} from "../../design-system";
import { theme } from "../../theme";
import { contrastRatio, toHex, tokenColor } from "./contrast";
import styles from "./DesignSystemPage.module.css";

/* INTERNAL — the admin design system, live. Development builds only (see
   src/config.ts); never part of a production bundle unless
   VITE_ADMIN_DESIGN_SYSTEM=true is set on purpose.

   Every example here is illustrative: the rows, names and messages are
   labelled examples, not data from the API. */

export default function DesignSystemPage() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setThemeMode(dark ? "dark" : theme.defaultMode);
    return () => setThemeMode(theme.defaultMode);
  }, [dark]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Badge tone="warning">Internal · development only</Badge>}
        title="Design system"
        description="Tokens and components of the admin, rendered live. Everything below uses semantic tokens only; brand values come from the theme config."
        actions={<Switch label="Dark theme" description="Architecture preview — not designed" checked={dark} onChange={(e) => setDark(e.target.checked)} />}
      />
      <div className={styles.sections}>
        <BrandSection />
        <ColorSection dark={dark} />
        <ContrastSection dark={dark} />
        <TypographySection />
        <ScalesSection />
        <ButtonSection />
        <FormSection />
        <BadgeSection />
        <SurfaceSection />
        <NavigationSection />
        <OverlaySection />
        <FeedbackSection />
        <TableSection />
      </div>
    </PageContainer>
  );
}

function Demo({ label, children, column = false }: { label: string; children: ReactNode; column?: boolean }) {
  return (
    <figure className={styles.demo}>
      <figcaption className={styles.demoLabel}>{label}</figcaption>
      <div className={column ? styles.demoColumn : styles.demoRow}>{children}</div>
    </figure>
  );
}

function BrandSection() {
  const { identity, colors } = theme;
  return (
    <PageSection title="Brand" description="The theme config (src/theme/rbb.ts). A fork replaces these values; components do not change.">
      <div className={styles.twoUp}>
        <Card padding="lg">
          <dl className={styles.facts}>
            <dt>Organization</dt>
            <dd>{identity.organizationName}</dd>
            <dt>Product</dt>
            <dd>{identity.productName}</dd>
            <dt>Logo</dt>
            <dd className={styles.inline}>
              {identity.logo.src ? <img src={identity.logo.src} alt="" width={32} height={32} /> : null}
              <Text as="span" variant="caption" tone="muted">
                Monogram fallback: {identity.logo.monogram}
              </Text>
            </dd>
            <dt>Default mode</dt>
            <dd>{theme.defaultMode}</dd>
          </dl>
        </Card>
        <div className={styles.swatchGrid}>
          {Object.entries(colors).map(([name, value]) => (
            <div key={name} className={styles.swatch}>
              <span className={styles.chip} style={{ background: value }} />
              <span className={styles.swatchName}>{name}</span>
              <code className={styles.swatchValue}>{value.toUpperCase()}</code>
            </div>
          ))}
        </div>
      </div>
    </PageSection>
  );
}

function useResolvedTokens(tokens: readonly string[], dependency: unknown) {
  const [values, setValues] = useState<Record<string, string>>({});
  useLayoutEffect(() => {
    const next: Record<string, string> = {};
    for (const token of tokens) {
      const rgb = tokenColor(token);
      next[token] = rgb ? toHex(rgb) : "—";
    }
    setValues(next);
  }, [tokens, dependency]);
  return values;
}

const ALL_COLOR_TOKENS = COLOR_GROUPS.flatMap((group) => group.tokens);

function ColorSection({ dark }: { dark: boolean }) {
  const values = useResolvedTokens(ALL_COLOR_TOKENS, dark);
  return (
    <PageSection title="Semantic colour" description="What components read. Hover, tint and focus colours are derived from the brand values with color-mix().">
      <div className={styles.colorGroups}>
        {COLOR_GROUPS.map((group) => (
          <div key={group.name}>
            <Text variant="label" tone="strong" className={styles.groupTitle}>
              {group.name}
            </Text>
            <div className={styles.swatchGrid}>
              {group.tokens.map((token) => (
                <div key={token} className={styles.swatch}>
                  <span className={styles.chip} style={{ background: `var(${token})` }} />
                  <code className={styles.swatchName}>{token.replace("--color-", "")}</code>
                  <code className={styles.swatchValue}>{values[token]}</code>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageSection>
  );
}

function ContrastSection({ dark }: { dark: boolean }) {
  const [rows, setRows] = useState<{ fg: string; bg: string; min: number; ratio: number }[]>([]);
  useLayoutEffect(() => {
    setRows(
      CONTRAST_PAIRS.map((pair) => {
        const fg = tokenColor(pair.fg);
        const bg = tokenColor(pair.bg);
        return { ...pair, ratio: fg && bg ? contrastRatio(fg, bg) : 0 };
      })
    );
  }, [dark]);
  const failing = rows.filter((row) => row.ratio < row.min).length;
  return (
    <PageSection
      title="Contrast"
      description="Measured from the rendered tokens. Text needs 4.5:1 (WCAG AA); focus rings and control edges need 3:1."
      actions={rows.length > 0 && <StatusBadge status={failing ? "error" : "success"} label={failing ? `${failing} below minimum` : "All pairs pass"} />}
    >
      <Table label="Contrast checks" density="compact" data-testid="contrast-table">
        <TableHeader>
          <TableRow>
            <TableHead>Foreground</TableHead>
            <TableHead>Background</TableHead>
            <TableHead align="end">Ratio</TableHead>
            <TableHead align="end">Minimum</TableHead>
            <TableHead>Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.fg}|${row.bg}`} data-contrast-ok={row.ratio >= row.min ? "true" : "false"}>
              <TableCell mono>{row.fg}</TableCell>
              <TableCell mono>{row.bg}</TableCell>
              <TableCell mono align="end">
                {row.ratio.toFixed(2)}:1
              </TableCell>
              <TableCell mono align="end" muted>
                {row.min}:1
              </TableCell>
              <TableCell>
                <StatusBadge size="sm" status={row.ratio >= row.min ? "success" : "error"} label={row.ratio >= row.min ? "Pass" : "Fail"} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </PageSection>
  );
}

function TypographySection() {
  return (
    <PageSection title="Typography" description="Geist Sans and Geist Mono. Body copy is 14px; tokens set size, line height, weight and tracking per role.">
      <Card>
        <div className={styles.typeList}>
          {TYPE_ROLES.map(({ role, sample }) => (
            <div key={role} className={styles.typeRow}>
              <code className={styles.typeToken}>{role}</code>
              <span className={`ds-text-${role} ${styles.typeSample}`}>{sample}</span>
            </div>
          ))}
        </div>
      </Card>
    </PageSection>
  );
}

function ScalesSection() {
  return (
    <PageSection title="Space, radius and elevation" description="An 8px rhythm with 4px half-steps. Borders separate cards; shadows are only for layers that float.">
      <div className={styles.threeUp}>
        <Panel title="Spacing" as="h3">
          <div className={styles.scaleList}>
            {SPACING.map(({ token, px }) => (
              <div key={token} className={styles.scaleRow}>
                <code className={styles.scaleToken}>{token}</code>
                <span className={styles.spaceBar} style={{ width: px }} />
                <span className={styles.scaleValue}>{px}px</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Radius" as="h3">
          <div className={styles.radiusGrid}>
            {RADII.map(({ token, px, use }) => (
              <div key={token} className={styles.radiusItem}>
                <span className={styles.radiusBox} style={{ borderRadius: `var(${token})` }} />
                <code className={styles.scaleToken}>
                  {token} · {px}px
                </code>
                <Text as="span" variant="caption" tone="muted">
                  {use}
                </Text>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Elevation" as="h3">
          <div className={styles.shadowGrid}>
            {SHADOWS.map(({ token, use }) => (
              <div key={token} className={styles.shadowItem} style={{ boxShadow: `var(${token})` }}>
                <code className={styles.scaleToken}>{token}</code>
                <Text as="span" variant="caption" tone="muted">
                  {use}
                </Text>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </PageSection>
  );
}

function ButtonSection() {
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setLoading(false), 2000);
    return () => window.clearTimeout(timer);
  }, [loading]);
  return (
    <PageSection title="Buttons" description="Primary for the one main action in a view; secondary for the rest; ghost in toolbars; destructive only where something is deleted.">
      <Card padding="lg">
        <div className={styles.stack}>
          <Demo label="Variants">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </Demo>
          <Demo label="Sizes">
            <Button variant="primary" size="sm">
              Small
            </Button>
            <Button variant="primary" size="md">
              Medium
            </Button>
            <Button variant="primary" size="lg">
              Large
            </Button>
          </Demo>
          <Demo label="With icons">
            <Button variant="primary" leadingIcon={<Plus />}>
              New item
            </Button>
            <Button leadingIcon={<Copy />}>Duplicate</Button>
            <Button variant="ghost" leadingIcon={<Pencil />}>
              Edit
            </Button>
          </Demo>
          <Demo label="States">
            <Button variant="primary" loading={loading} onClick={() => setLoading(true)}>
              {loading ? "Saving" : "Click to load"}
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
            <Button disabled>Disabled</Button>
            <Tooltip content="Unavailable controls stay focusable so this can explain why">
              <Button aria-disabled="true">Unavailable</Button>
            </Tooltip>
          </Demo>
          <Demo label="Icon buttons (with tooltips)">
            {(["sm", "md", "lg"] as const).map((size) => (
              <Tooltip key={size} content={`Edit (${size})`} labelOnly>
                <IconButton label={`Edit (${size})`} icon={<Pencil />} size={size} />
              </Tooltip>
            ))}
            <Tooltip content="Add" labelOnly>
              <IconButton label="Add" icon={<Plus />} variant="secondary" />
            </Tooltip>
            <Tooltip content="Delete" labelOnly>
              <IconButton label="Delete" icon={<Trash2 />} variant="destructive" />
            </Tooltip>
          </Demo>
        </div>
      </Card>
    </PageSection>
  );
}

function FormSection() {
  const [title, setTitle] = useState("");
  const [touched, setTouched] = useState(false);
  const titleError = touched && title.trim().length === 0 ? "Enter a title." : undefined;
  const [visibility, setVisibility] = useState("draft");
  return (
    <PageSection title="Form controls" description="FormField wires label, helper, error, required and disabled into the control it wraps.">
      <div className={styles.twoUp}>
        <Card padding="lg">
          <div className={styles.formStack}>
            <FormField label="Title" required helper="Shown as the page heading." error={titleError}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => setTouched(true)} placeholder="Example title" />
            </FormField>
            <FormField label="Search" helper="An input with a leading icon.">
              <Input leadingIcon={<Search />} placeholder="Search examples" type="search" />
            </FormField>
            <FormField label="Summary" helper="Up to a few sentences.">
              <Textarea placeholder="Example summary" />
            </FormField>
            <FormField label="Category">
              <Select
                placeholder="Choose a category"
                defaultValue=""
                options={[
                  { value: "a", label: "Example category A" },
                  { value: "b", label: "Example category B" },
                  { value: "c", label: "Unavailable category", disabled: true },
                ]}
              />
            </FormField>
            <FormField label="Slug" disabled helper="Disabled fields cannot be focused or edited.">
              <Input defaultValue="example-slug" />
            </FormField>
            <FormField label="Reference" error="This reference is already in use.">
              <Input defaultValue="EX-001" />
            </FormField>
          </div>
        </Card>
        <Card padding="lg">
          <div className={styles.formStack}>
            <div className={styles.choiceStack}>
              <Checkbox label="Show in navigation" defaultChecked />
              <Checkbox label="Feature on the home page" description="A checkbox with a description." />
              <Checkbox label="Select all (partial)" indeterminate />
              <Checkbox label="Disabled option" disabled />
              <Checkbox label="Disabled and checked" disabled defaultChecked />
            </div>
            <Separator />
            <RadioGroup legend="Visibility" value={visibility} onValueChange={setVisibility} helper="Arrow keys move between options.">
              <Radio value="draft" label="Draft" description="Only editors can see it." />
              <Radio value="published" label="Published" />
              <Radio value="archived" label="Archived" />
            </RadioGroup>
            <RadioGroup legend="Layout (disabled)" orientation="horizontal" disabled>
              <Radio value="a" label="Option A" defaultChecked />
              <Radio value="b" label="Option B" />
            </RadioGroup>
            <Separator />
            <div className={styles.choiceStack}>
              <Switch label="Email notifications" description="A setting that applies at once." defaultChecked />
              <Switch label="Maintenance mode" />
              <Switch label="Disabled switch" disabled />
            </div>
          </div>
        </Card>
      </div>
    </PageSection>
  );
}

function BadgeSection() {
  return (
    <PageSection title="Badges and status" description="Status is never colour alone: each state has its own icon and word.">
      <Card padding="lg">
        <div className={styles.stack}>
          <Demo label="StatusBadge">
            {(Object.keys(STATUS_PRESENTATION) as Status[]).map((status) => (
              <StatusBadge key={status} status={status} />
            ))}
          </Demo>
          <Demo label="Badge tones">
            <Badge>Neutral</Badge>
            <Badge tone="brand">Brand</Badge>
            <Badge tone="info">Info</Badge>
            <Badge tone="success">Success</Badge>
            <Badge tone="warning">Warning</Badge>
            <Badge tone="danger">Danger</Badge>
            <Badge tone="scheduled">Scheduled</Badge>
            <Badge size="sm">Small</Badge>
          </Demo>
        </div>
      </Card>
    </PageSection>
  );
}

function SurfaceSection() {
  return (
    <PageSection title="Cards, surfaces and panels" description="1px borders, no resting shadows.">
      <div className={styles.threeUp}>
        <Card>
          <CardHeader title="Card" description="Header, body and footer." actions={<IconButton label="More" icon={<Ellipsis />} size="sm" />} />
          <CardBody>
            <Text tone="muted">A card groups one object or one task.</Text>
          </CardBody>
          <CardFooter>
            <Button size="sm">Cancel</Button>
            <Button size="sm" variant="primary">
              Save
            </Button>
          </CardFooter>
        </Card>
        <Panel title="Panel" description="A titled section of a page." as="h3" actions={<Button size="sm">Action</Button>}>
          <Text tone="muted">Panels hold settings groups and lists.</Text>
        </Panel>
        <div className={styles.stack}>
          <Surface bordered>
            <Text variant="label">Surface</Text>
            <Text variant="caption" tone="muted">
              tone = surface
            </Text>
          </Surface>
          <Surface tone="subtle" bordered>
            <Text variant="label">Surface</Text>
            <Text variant="caption" tone="muted">
              tone = subtle
            </Text>
          </Surface>
          <Surface tone="canvas" bordered>
            <Text variant="label">Surface</Text>
            <Text variant="caption" tone="muted">
              tone = canvas
            </Text>
          </Surface>
        </div>
      </div>
    </PageSection>
  );
}

function NavigationSection() {
  return (
    <PageSection title="Tabs" description="Arrow keys move between tabs; Home and End jump to the ends; disabled tabs are skipped.">
      <Card padding="lg">
        <Tabs
          label="Example tabs"
          items={[
            { id: "general", label: "General", content: <Text tone="muted">General settings would appear here.</Text> },
            { id: "content", label: "Content", content: <Text tone="muted">Content settings would appear here.</Text> },
            { id: "seo", label: "Search", content: <Text tone="muted">Search settings would appear here.</Text> },
            { id: "advanced", label: "Advanced", content: null, disabled: true },
          ]}
        />
      </Card>
    </PageSection>
  );
}

function OverlaySection() {
  const [formOpen, setFormOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();
  const nameRef = useRef<HTMLInputElement>(null);
  return (
    <PageSection title="Overlays" description="Tooltip, menu and dialog. Escape closes each; focus returns to what opened it.">
      <Card padding="lg">
        <div className={styles.stack}>
          <Demo label="Tooltip">
            <Tooltip content="Tooltips describe; they never hold actions">
              <Button>Hover or focus me</Button>
            </Tooltip>
            <Tooltip content="Placed below" side="bottom">
              <Button variant="ghost">Bottom</Button>
            </Tooltip>
          </Demo>
          <Demo label="Menu">
            <Menu
              trigger={(props) => (
                <Button {...props} trailingIcon={<Ellipsis />}>
                  Actions
                </Button>
              )}
            >
              <MenuLabel>Example item</MenuLabel>
              <MenuItem icon={<Pencil />} onSelect={() => toast({ title: "Edit chosen", description: "Example action — nothing was changed." })}>
                Edit
              </MenuItem>
              <MenuItem icon={<Copy />} onSelect={() => toast({ title: "Duplicate chosen", description: "Example action — nothing was changed." })}>
                Duplicate
              </MenuItem>
              <MenuItem icon={<FileText />} disabled>
                Export (unavailable)
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<Trash2 />} destructive onSelect={() => setConfirmOpen(true)}>
                Delete
              </MenuItem>
            </Menu>
          </Demo>
          <Demo label="Dialog">
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              Open form dialog
            </Button>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              Open confirmation
            </Button>
          </Demo>
        </div>
      </Card>
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Rename example"
        description="A dialog with a form. Focus starts in the field and is trapped until it closes."
        initialFocus={nameRef}
        dismissOnBackdrop={false}
        footer={
          <>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                setFormOpen(false);
                toast({ title: "Example saved", description: "Nothing was sent anywhere.", tone: "success" });
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <FormField label="Name">
          <Input ref={nameRef} defaultValue="Example name" />
        </FormField>
      </Dialog>
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        size="sm"
        title="Delete example?"
        description="This is a preview. In the product, this would remove the item permanently."
        footer={
          <>
            <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmOpen(false);
                toast({ title: "Example deleted", description: "Nothing was deleted — this is a preview.", tone: "danger" });
              }}
            >
              Delete
            </Button>
          </>
        }
      />
    </PageSection>
  );
}

function FeedbackSection() {
  const { toast } = useToast();
  return (
    <PageSection title="Feedback" description="Toasts for passing confirmation; alerts for messages that stay; empty and loading states.">
      <div className={styles.twoUp}>
        <Card padding="lg">
          <div className={styles.stack}>
            <Demo label="Toast">
              <Button onClick={() => toast({ title: "Example notice" })}>Neutral</Button>
              <Button onClick={() => toast({ title: "Example saved", tone: "success" })}>Success</Button>
              <Button onClick={() => toast({ title: "Example warning", description: "Something needs attention.", tone: "warning" })}>Warning</Button>
              <Button onClick={() => toast({ title: "Example failure", description: "Danger toasts stay longer.", tone: "danger" })}>Danger</Button>
            </Demo>
            <Demo label="Alert" column>
              <Alert tone="info" title="Information">
                A message that stays on the page.
              </Alert>
              <Alert tone="success">Changes were saved.</Alert>
              <Alert tone="warning" title="Check before publishing">
                Some fields are incomplete.
              </Alert>
              <Alert tone="danger">The example could not be saved.</Alert>
            </Demo>
            <Demo label="Avatar">
              <Avatar name="Example Person" size="sm" />
              <Avatar name="Example Person" />
              <Avatar name="Example" size="lg" />
            </Demo>
            <Demo label="Loading">
              <Spinner size="sm" />
              <Spinner />
              <Spinner size="lg" />
              <div className={styles.skeletons} aria-hidden="true">
                <Skeleton width="80%" />
                <Skeleton width="60%" />
                <Skeleton width="40%" />
              </div>
            </Demo>
          </div>
        </Card>
        <Card>
          <EmptyState
            as="h3"
            icon={Bell}
            title="Empty state"
            description="Say what will appear here and how to get started."
            actions={
              <Button variant="primary" leadingIcon={<Plus />}>
                Example action
              </Button>
            }
          />
        </Card>
      </div>
    </PageSection>
  );
}

const EXAMPLE_ROWS: { id: string; title: string; status: Status; updated: string; ref: string }[] = [
  { id: "1", title: "Example item A", status: "published", updated: "2026-01-12", ref: "EX-001" },
  { id: "2", title: "Example item B", status: "draft", updated: "2026-01-10", ref: "EX-002" },
  { id: "3", title: "Example item C", status: "scheduled", updated: "2026-01-08", ref: "EX-003" },
  { id: "4", title: "Example item D", status: "archived", updated: "2025-12-19", ref: "EX-004" },
];

function TableSection() {
  const [compact, setCompact] = useState(false);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(["2"]));
  const allSelected = selected.size === EXAMPLE_ROWS.length;
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const rows = empty ? [] : EXAMPLE_ROWS;
  return (
    <PageSection
      title="Table"
      description="The foundation only: structure, hover, selection, density, empty and loading states, horizontal overflow. Rows are labelled examples."
      actions={
        <div className={styles.inline}>
          <Switch label="Compact" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
          <Switch label="Loading" checked={loading} onChange={(e) => setLoading(e.target.checked)} />
          <Switch label="Empty" checked={empty} onChange={(e) => setEmpty(e.target.checked)} />
        </div>
      }
    >
      <div className={styles.stack}>
        <Table label="Example items" density={compact ? "compact" : "default"} loading={loading}>
          <TableHeader>
            <TableRow>
              <TableHead shrink>
                <Checkbox
                  aria-label="Select all example rows"
                  checked={allSelected}
                  indeterminate={selected.size > 0 && !allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(EXAMPLE_ROWS.map((r) => r.id)))}
                  disabled={loading || rows.length === 0}
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead align="end">Updated</TableHead>
              <TableHead shrink>
                <span className="ds-visually-hidden">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableLoading colSpan={6} />
            ) : rows.length === 0 ? (
              <TableEmpty colSpan={6} icon={Inbox} title="No items yet" description="Items you create will be listed here." />
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} selected={selected.has(row.id)}>
                  <TableCell shrink>
                    <Checkbox aria-label={`Select ${row.title}`} checked={selected.has(row.id)} onChange={() => toggle(row.id)} />
                  </TableCell>
                  <TableCell>
                    <span className={styles.cellTitle}>{row.title}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={row.status} size={compact ? "sm" : "md"} />
                  </TableCell>
                  <TableCell mono muted>
                    {row.ref}
                  </TableCell>
                  <TableCell mono align="end" muted>
                    {row.updated}
                  </TableCell>
                  <TableCell shrink>
                    <Menu align="end" trigger={(props) => <IconButton {...props} label={`Actions for ${row.title}`} icon={<Ellipsis />} size="sm" />}>
                      <MenuItem icon={<Pencil />}>Edit</MenuItem>
                      <MenuItem icon={<Trash2 />} destructive>
                        Delete
                      </MenuItem>
                    </Menu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Table label="Wide example (scrolls horizontally)" density="compact">
          <TableHeader>
            <TableRow>
              {Array.from({ length: 12 }, (_, i) => (
                <TableHead key={i}>Column {i + 1}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 3 }, (_, row) => (
              <TableRow key={row}>
                {Array.from({ length: 12 }, (_, col) => (
                  <TableCell key={col} className={styles.nowrap}>
                    Example value {row + 1}.{col + 1}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PageSection>
  );
}
