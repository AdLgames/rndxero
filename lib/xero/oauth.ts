/**
 * Xero OAuth 2.0 — authorization code flow with minimal read scopes.
 * This product never writes to the ledger, so no write scopes are ever
 * requested (PLAN.md Phase 3).
 */

export const XERO_READ_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.transactions.read",
  "accounting.journals.read",
  "accounting.settings.read",
] as const;

export interface XeroOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function buildXeroAuthorizeUrl(config: Pick<XeroOAuthConfig, "clientId" | "redirectUri">, state: string): string {
  const url = new URL("https://login.xero.com/identity/connect/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", XERO_READ_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export type FetchFn = typeof fetch;

async function postToken(
  config: XeroOAuthConfig,
  body: URLSearchParams,
  fetchFn: FetchFn
): Promise<XeroTokenResponse> {
  const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetchFn("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`Xero token request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as XeroTokenResponse;
}

export function exchangeCodeForTokens(
  config: XeroOAuthConfig,
  code: string,
  fetchFn: FetchFn = fetch
): Promise<XeroTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });
  return postToken(config, body, fetchFn);
}

export function refreshXeroTokens(
  config: XeroOAuthConfig,
  refreshToken: string,
  fetchFn: FetchFn = fetch
): Promise<XeroTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return postToken(config, body, fetchFn);
}

export interface XeroConnectionSummary {
  tenantId: string;
  tenantName: string;
}

/** Lists the tenants (organisations) the just-obtained token can access. */
export async function fetchXeroConnections(
  accessToken: string,
  fetchFn: FetchFn = fetch
): Promise<XeroConnectionSummary[]> {
  const response = await fetchFn("https://api.xero.com/connections", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Xero connections request failed: ${response.status} ${response.statusText}`);
  }
  const connections = (await response.json()) as Array<{ tenantId: string; tenantName: string }>;
  return connections.map((c) => ({ tenantId: c.tenantId, tenantName: c.tenantName }));
}

/** True once less than the token's lifetime minus a safety margin remains. */
export function isTokenExpiringSoon(expiresAt: Date, marginMs = 5 * 60 * 1000): boolean {
  return expiresAt.getTime() - Date.now() < marginMs;
}
