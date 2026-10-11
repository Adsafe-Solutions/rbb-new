import { ProviderError } from "../provider.ts";

/* The ONE place the API talks to Givebutter over HTTP.

     base URL   https://api.givebutter.com/v1
     auth       Authorization: Bearer <GIVEBUTTER_API_KEY>
     timeout    8 s per request (AbortSignal), then `unavailable`
     retries    none — every call is a read for an admin screen; the caller
                can try again, and retrying a 429 would only dig deeper

   The key exists only in this object's memory and the request header. It
   is never logged, never put in an error, and never returned: failures
   become a ProviderError carrying a category and the HTTP status only —
   not Givebutter's response body. */

export const GIVEBUTTER_API = "https://api.givebutter.com/v1";

export interface GivebutterClientOptions {
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  baseUrl?: string;
}

export class GivebutterClient {
  readonly #apiKey: string;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;
  readonly #baseUrl: string;

  constructor({ apiKey, fetch: fetchImpl = fetch, timeoutMs = 8_000, baseUrl = GIVEBUTTER_API }: GivebutterClientOptions) {
    if (!apiKey) throw new ProviderError("not-configured");
    this.#apiKey = apiKey;
    this.#fetch = fetchImpl;
    this.#timeoutMs = timeoutMs;
    this.#baseUrl = baseUrl;
  }

  /* GET a path ("/campaigns?page=2"). Resolves to the parsed JSON body of a
     2xx response; anything else throws ProviderError. */
  async get(path: string): Promise<unknown> {
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${this.#apiKey}`, Accept: "application/json" },
        signal: AbortSignal.timeout(this.#timeoutMs),
      });
    } catch {
      /* Timeout, DNS, TLS, connection reset — the cause can carry request
         details, so it is not kept. */
      throw new ProviderError("unavailable");
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      const status = response.status;
      if (status === 401 || status === 403) throw new ProviderError("unauthorized", { status });
      if (status === 404) throw new ProviderError("not-found", { status });
      if (status === 429) {
        const retry = Number(response.headers.get("retry-after"));
        throw new ProviderError("rate-limited", { status, retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? retry : null });
      }
      throw new ProviderError("unavailable", { status });
    }

    try {
      return await response.json();
    } catch {
      throw new ProviderError("bad-response", { status: response.status });
    }
  }
}
