import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // pdfkit locates its bundled .afm font files via __dirname at require time;
  // letting Next's bundler pull it into the route handler's bundle rewrites
  // that path and breaks the lookup (ENOENT on Helvetica.afm). Keeping it as
  // a real external require, resolved from node_modules like plain Node
  // would, is what preserves the path pdfkit expects.
  serverExternalPackages: ["pdfkit"],
};

// No-op (and silent) when SENTRY_DSN/SENTRY_AUTH_TOKEN aren't set — see instrumentation.ts.
export default withSentryConfig(nextConfig, {
  silent: true,
});
