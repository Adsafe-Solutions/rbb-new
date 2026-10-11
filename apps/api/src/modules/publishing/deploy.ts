/* What happens AFTER a publish: telling the public site to rebuild from
   the new snapshot. Publishing never depends on it — the snapshot is live
   for the next build either way — and its outcome is reported honestly:
   "not-configured" when there is no hook, never a pretend success.

     NoDeploymentTrigger      no hook configured (today's default)
     WebhookDeploymentTrigger POSTs to a build hook URL (Cloudflare Pages
                              and Vercel both offer one), from
                              DEPLOY_HOOK_URL; the URL is a secret and is
                              never logged or returned */

export type DeploymentOutcome =
  | { status: "triggered" }
  | { status: "not-configured" }
  | { status: "failed"; reason: "timeout" | "rejected" | "network" };

export interface DeploymentTrigger {
  readonly name: string;
  trigger(event: { orgId: string; version: number }): Promise<DeploymentOutcome>;
}

export class NoDeploymentTrigger implements DeploymentTrigger {
  readonly name = "none";
  async trigger(): Promise<DeploymentOutcome> {
    return { status: "not-configured" };
  }
}

export class WebhookDeploymentTrigger implements DeploymentTrigger {
  readonly name = "webhook";
  readonly #url: string;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  constructor(url: string, { fetch: fetchImpl = fetch, timeoutMs = 8000 }: { fetch?: typeof fetch; timeoutMs?: number } = {}) {
    this.#url = url;
    this.#fetch = fetchImpl;
    this.#timeoutMs = timeoutMs;
  }

  async trigger(event: { orgId: string; version: number }): Promise<DeploymentOutcome> {
    try {
      const response = await this.#fetch(this.#url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: "snapshot.published", organization: event.orgId, version: event.version }),
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
      await response.body?.cancel().catch(() => {});
      return response.ok ? { status: "triggered" } : { status: "failed", reason: "rejected" };
    } catch (error) {
      return { status: "failed", reason: (error as Error).name === "TimeoutError" ? "timeout" : "network" };
    }
  }
}
