import { createApp } from "../app.ts";
import { ConfigError, loadConfig } from "../config/env.ts";
import { guardTarget } from "./target-guard.ts";

/* Scheduled publishing, run once (M15) — for a cron that runs commands
   instead of calling a URL, and for local use. It does exactly what
   GET /api/v1/internal/scheduler/run does (through the same app and
   route, with CRON_SECRET), so there is one scheduler, whatever triggers
   it: publish the website if an approved schedule is due, finish a publish
   that stopped part-way, retry a failed deployment trigger. Idempotent;
   prints the outcome only. Against the production database it needs the
   database's name, typed: --production=<database> (config/target.ts);
   the deployed scheduler is the cron route, not this command. */
try {
  const config = loadConfig();
  if (!config.mongo) throw new ConfigError(["MONGODB_URI and MONGODB_DB are required"]);
  if (!config.scheduler) throw new ConfigError(["CRON_SECRET is required (it turns the scheduler on)"]);
  guardTarget(config, "maintenance");
  const app = createApp({ config, write: () => {} });
  const response = await app.handle(new Request("http://scheduler.internal/api/v1/internal/scheduler/run", { headers: { authorization: `Bearer ${config.scheduler.secret}` } }), { clientIp: null });
  const body = (await response.json()) as { data?: unknown; error?: { code: string; message: string } };
  if (!response.ok) {
    console.error(`Scheduler run failed: ${response.status} ${body.error?.code ?? ""} ${body.error?.message ?? ""}`.trim());
    process.exit(1);
  }
  console.log(JSON.stringify(body.data));
  process.exit(0);
} catch (error) {
  if (error instanceof ConfigError) console.error(`Configuration problems:\n  ${error.problems.join("\n  ")}`);
  else console.error(`Scheduler run failed: ${(error as Error).name}`);
  process.exit(1);
}
