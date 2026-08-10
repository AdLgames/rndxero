/** Client-side Sentry init — same no-op-until-DSN-is-set approach as instrumentation.ts. */
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, tracesSampleRate: 0.1 });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
