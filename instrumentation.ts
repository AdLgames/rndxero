/**
 * Sentry init — a no-op until SENTRY_DSN is set (PLAN.md Phase 6). No
 * DSN exists for this repo; wiring is in place so turning on error
 * tracking is a one-line env var away, not a code change.
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
  }
}

export const onRequestError = async (...args: Parameters<NonNullable<typeof import("@sentry/nextjs").captureRequestError>>) => {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
};
