import { describe, expect, it, vi } from "vitest";
import { RetryExhaustedError, withXeroRateLimitRetry } from "@/lib/xero/rate-limit";

function jsonResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response("{}", { status, headers });
}

describe("withXeroRateLimitRetry", () => {
  it("returns immediately on a non-429 response", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(200));
    const response = await withXeroRateLimitRetry(fetchFn);
    expect(response.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 honouring the Retry-After header (seconds)", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { "Retry-After": "2" }))
      .mockResolvedValueOnce(jsonResponse(200));

    const response = await withXeroRateLimitRetry(fetchFn, { sleep });

    expect(response.status).toBe(200);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("falls back to exponential backoff when Retry-After is absent", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429))
      .mockResolvedValueOnce(jsonResponse(429))
      .mockResolvedValueOnce(jsonResponse(200));

    await withXeroRateLimitRetry(fetchFn, { sleep, fallbackBackoffMs: 100 });

    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
  });

  it("throws RetryExhaustedError after maxAttempts consecutive 429s", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(429));

    await expect(
      withXeroRateLimitRetry(fetchFn, { sleep, maxAttempts: 3 })
    ).rejects.toThrow(RetryExhaustedError);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
