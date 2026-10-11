import { Button, Card, EmptyState, PageContainer, PageHeader, Search } from "../design-system";
import { navigate } from "../router";

export function NotFoundPage() {
  return (
    <PageContainer width="narrow">
      <PageHeader title="Page not found" />
      <Card>
        <EmptyState
          icon={Search}
          title="There is nothing at this address"
          description="The link may be mistyped, or it may point to a section that has not been released yet."
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
