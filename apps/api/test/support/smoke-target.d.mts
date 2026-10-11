/* Types for smoke-target.mjs (plain JS: the admin's and website's smoke scripts import it too). */
export function smokeTargetProblem(base: string, options?: { fetch?: typeof fetch; apiUrl?: string }): Promise<string | null>;
export function requireTestTarget(base: string, options?: { fetch?: typeof fetch; apiUrl?: string }): Promise<void>;
