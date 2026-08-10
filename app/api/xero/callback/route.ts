import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exchangeCodeForTokens, fetchXeroConnections } from "@/lib/xero/oauth";
import { upsertXeroConnection } from "@/lib/xero/repository";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const stateCookie = request.cookies.get("xero_oauth_state")?.value;

  if (!code || !state || !stateCookie) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  let parsedState: { nonce: string; companyId: string };
  try {
    parsedState = JSON.parse(stateCookie);
  } catch {
    return NextResponse.json({ error: "Invalid state cookie" }, { status: 400 });
  }

  if (parsedState.nonce !== state) {
    return NextResponse.json({ error: "State mismatch" }, { status: 400 });
  }

  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  const redirectUri = process.env.XERO_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "Xero OAuth is not configured" }, { status: 500 });
  }

  const tokens = await exchangeCodeForTokens({ clientId, clientSecret, redirectUri }, code);
  const connections = await fetchXeroConnections(tokens.access_token);
  const tenant = connections[0];
  if (!tenant) {
    return NextResponse.json({ error: "No Xero organisation authorised" }, { status: 400 });
  }

  await upsertXeroConnection(prisma, parsedState.companyId, tenant.tenantId, tokens);

  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete("xero_oauth_state");
  return response;
}
