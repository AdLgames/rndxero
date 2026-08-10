import { describe, expect, it } from "vitest";
import { buildXeroAuthorizeUrl, isTokenExpiringSoon, XERO_READ_SCOPES } from "@/lib/xero/oauth";

describe("buildXeroAuthorizeUrl", () => {
  it("builds an authorize URL with only read scopes", () => {
    const url = new URL(
      buildXeroAuthorizeUrl(
        { clientId: "client-1", redirectUri: "https://app.example.com/api/xero/callback" },
        "nonce-123"
      )
    );

    expect(url.origin + url.pathname).toBe("https://login.xero.com/identity/connect/authorize");
    expect(url.searchParams.get("client_id")).toBe("client-1");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.example.com/api/xero/callback");
    expect(url.searchParams.get("state")).toBe("nonce-123");
    expect(url.searchParams.get("scope")).toBe(XERO_READ_SCOPES.join(" "));
  });

  it("never requests a write scope", () => {
    expect(XERO_READ_SCOPES.some((scope) => scope.includes(".write"))).toBe(false);
  });
});

describe("isTokenExpiringSoon", () => {
  it("is true when within the safety margin", () => {
    const expiresAt = new Date(Date.now() + 60 * 1000);
    expect(isTokenExpiringSoon(expiresAt, 5 * 60 * 1000)).toBe(true);
  });

  it("is false when comfortably before expiry", () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    expect(isTokenExpiringSoon(expiresAt, 5 * 60 * 1000)).toBe(false);
  });
});
