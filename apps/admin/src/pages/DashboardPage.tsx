import type { AuthView } from "../api";
import { Badge, Button, Card, EmptyState, Image as ImageIcon, Inbox, PageContainer, PageHeader, Panel } from "../design-system";
import { navigate } from "../router";
import { roleLabel } from "../shell/Topbar";
import { brand } from "../theme";
import styles from "./DashboardPage.module.css";

/* The landing page after sign-in. Everything on it is real: the signed-in
   member, from /auth/me, and an honest statement that the content tools
   are not built yet. No placeholder figures or sample activity. */
export function DashboardPage({ view }: { view: AuthView }) {
  const firstName = view.user.name.trim().split(/\s+/)[0] || view.user.name;
  const expires = new Date(view.session.expiresAt);
  return (
    <PageContainer>
      <PageHeader title="Dashboard" description={`Welcome, ${firstName}. This is the ${brand.productName} workspace for ${brand.organizationName}.`} />
      <div className={styles.grid}>
        <Card className={styles.main}>
          <EmptyState
            icon={Inbox}
            title="Content tools are on the way"
            description="The media library is ready to use. Pages, appeals, posts and events will be managed here too; each appears in the sidebar as it is released."
            actions={
              <Button onClick={() => navigate("/media")} leadingIcon={<ImageIcon />}>
                Open the media library
              </Button>
            }
          />
        </Card>
        <Panel title="Your account" as="h2">
          <dl className={styles.facts}>
            <div>
              <dt>Name</dt>
              <dd data-testid="user-name">{view.user.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd data-testid="user-email">{view.user.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>
                <Badge tone="brand" data-testid="user-role">
                  {roleLabel(view.membership.role)}
                </Badge>
              </dd>
            </div>
            <div>
              <dt>Organization</dt>
              <dd className={styles.mono}>{view.organization.id}</dd>
            </div>
            <div>
              <dt>Session ends</dt>
              <dd>{Number.isNaN(expires.getTime()) ? "—" : expires.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </PageContainer>
  );
}
