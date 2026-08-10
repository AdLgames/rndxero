import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

// No-op (and silent) when SENTRY_DSN/SENTRY_AUTH_TOKEN aren't set — see instrumentation.ts.
export default withSentryConfig(nextConfig, {
  silent: true,
});
