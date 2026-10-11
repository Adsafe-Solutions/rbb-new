import type { ThrottleStore } from "./repository.ts";
import { pseudonym } from "./tokens.ts";

/* Brute-force protection for login, kept in MongoDB so it holds across
   serverless instances (an in-memory counter would reset with every cold
   start and differ between instances).

   Two fixed 15-minute windows:
     per IP        every attempt counts — at most 20 per window
     per account   failed attempts count — at most 5 per window
   Both counters are checked BEFORE the password is verified, so a blocked
   attempt costs no scrypt work. Keys are keyed hashes: no IP address or
   email is stored.

   Known limitation of fixed windows: up to twice the limit can land around
   a window boundary. Acceptable for login; a sliding window can replace it
   without changing callers. */
export const LOGIN_LIMITS = {
  windowMs: 15 * 60 * 1000,
  perIp: 20,
  perAccount: 5,
} as const;

export type ThrottleDecision = { blocked: false } | { blocked: true; retryAfterSeconds: number; firstBlock: boolean };

export class LoginThrottle {
  readonly #store: ThrottleStore;
  readonly #secret: string;
  readonly #now: () => Date;
  readonly #limits: typeof LOGIN_LIMITS;

  constructor(store: ThrottleStore, secret: string, now: () => Date = () => new Date(), limits: typeof LOGIN_LIMITS = LOGIN_LIMITS) {
    this.#store = store;
    this.#secret = secret;
    this.#now = now;
    this.#limits = limits;
  }

  #window() {
    const now = this.#now().getTime();
    const index = Math.floor(now / this.#limits.windowMs);
    const endsAt = (index + 1) * this.#limits.windowMs;
    return { index, endsAt, retryAfterSeconds: Math.max(1, Math.ceil((endsAt - now) / 1000)) };
  }

  /* Counts this attempt against the IP and checks both limits. */
  async attempt(clientIp: string | null, accountKey: string): Promise<ThrottleDecision> {
    const window = this.#window();
    const expiresAt = new Date(window.endsAt + this.#limits.windowMs);
    const ipCount = await this.#store.hit(`ip:${pseudonym(this.#secret, clientIp ?? "unknown")}:${window.index}`, expiresAt);
    if (ipCount > this.#limits.perIp)
      return { blocked: true, retryAfterSeconds: window.retryAfterSeconds, firstBlock: ipCount === this.#limits.perIp + 1 };
    const failures = await this.#store.peek(`account:${accountKey}:${window.index}`);
    if (failures >= this.#limits.perAccount) return { blocked: true, retryAfterSeconds: window.retryAfterSeconds, firstBlock: false };
    return { blocked: false };
  }

  /* Counts a failed attempt against the account. Returns true when this
     failure is the one that reaches the account limit. */
  async failed(accountKey: string): Promise<boolean> {
    const window = this.#window();
    const count = await this.#store.hit(`account:${accountKey}:${window.index}`, new Date(window.endsAt + this.#limits.windowMs));
    return count === this.#limits.perAccount;
  }
}
