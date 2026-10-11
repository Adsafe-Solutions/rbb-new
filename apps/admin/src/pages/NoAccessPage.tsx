import { Button, Card, EmptyState, PageContainer, PageHeader, ShieldCheck } from "../design-system";
import { navigate } from "../router";

/* A signed-in member opened a page their role does not include (the route
   names the permission). Nothing of the page is loaded: no request is made
   for data the API would refuse anyway. */
export function NoAccessPage() {
  return (
    <PageContainer width="narrow">
      <PageHeader title="No access" />
      <Card>
        <EmptyState
          icon={ShieldCheck}
          title="This page is for owners"
          description="Your role does not include it. If you need it, ask an owner of your organization."
          actions={
            <Button variant="primary" onClick={() => navigate("/")}>
              Go to the dashboard
            </Button>
          }
        />
      </Card>
    </PageContainer>
  );
}
