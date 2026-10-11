import type { Config } from "../config/env.ts";
import { describeTarget, scriptTargetProblems, type ScriptPurpose } from "../config/target.ts";

/* Phase 0: every command that writes says what it is about to touch and
   stops — before it connects — when it must not touch it
   (config/target.ts). Prints names only, never a connection string. */
export function guardTarget(config: Config, purpose: ScriptPurpose, argv: readonly string[] = process.argv): void {
  console.log(`Target: ${describeTarget(config.target)}, organization "${config.orgId}"${config.target.bucket ? `, bucket "${config.target.bucket}"` : ""}.`);
  const problems = scriptTargetProblems(config.target, purpose, argv);
  if (!problems.length) return;
  console.error(`Refusing: ${problems.join("; ")}. Nothing was changed.`);
  process.exit(1);
}
