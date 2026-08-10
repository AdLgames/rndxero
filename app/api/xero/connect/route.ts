import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildXeroAuthorizeUrl } from "@/lib/xero/oauth";

/**
 * Starts the Xero OAuth flow for a company. `companyId` is a query param
 * for now — once Phase 4's session auth is in place this should instead
 * come from the authenticated admin's session, not an unauthenticated
 * request param.
 */
export async function GET(request: NextRequest) {
  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const clientId = process.env.XERO_CLIENT_ID;
  const redirectUri = process.env.XERO_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Xero OAuth is not configured" }, { status: 500 });
  }

  const nonce = randomBytes(16).toString("hex");
  const authorizeUrl = buildXeroAuthorizeUrl({ clientId, redirectUri }, nonce);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("xero_oauth_state", JSON.stringify({ nonce, companyId }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
