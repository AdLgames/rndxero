/**
 * Retry/backoff for Xero API calls.
 *
 * Xero's documented limits: 60 calls/minute and 5,000/day per tenant,
 * 10,000/minute app-wide (PLAN.md Phase 3). A large backfill will hit the
 * per-minute limit by design, so a 429 is an expected, retryable response
 * — not a failure. Xero returns a `Retry-After` header (seconds) on 429;
 * honour it exactly rather than guessing a backoff.
 */

export interface RetryOptions {
  maxAttempts?: number;
  /** Backoff (ms) used when the response carries no Retry-After header. */
  fallbackBackoffMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export class RetryExhaustedError extends Error {
  constructor(attempts: number, lastStatus: number) {
    super(`Gave up after ${attempts} attempts (last status ${lastStatus})`);
    this.name = "RetryExhaustedError";
  }
}

function parseRetryAfterMs(response: Response): number | null {
  const header = response.headers.get("Retry-After");
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const dateMs = Date.parse(header);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
}

/**
 * Calls `fetchFn`, retrying on HTTP 429 using the response's Retry-After
 * header (falling back to exponential backoff if the header is absent).
 * Any other status is returned as-is — callers decide what counts as an
 * error for non-429 responses.
 */
export async function withXeroRateLimitRetry(
  fetchFn: () => Promise<Response>,
  options: RetryOptions = {}
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? 5;
  const fallbackBackoffMs = options.fallbackBackoffMs ?? 1000;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  let lastStatus = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetchFn();
    if (response.status !== 429) {
      return response;
    }
    lastStatus = response.status;
    if (attempt === maxAttempts) break;

    const waitMs = parseRetryAfterMs(response) ?? fallbackBackoffMs * 2 ** (attempt - 1);
    await sleep(waitMs);
  }
  throw new RetryExhaustedError(maxAttempts, lastStatus);
}
