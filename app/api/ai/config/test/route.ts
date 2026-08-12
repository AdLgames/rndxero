import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { getAiProviderSettings } from "@/lib/ai/repository";
import { testConnection } from "@/lib/ai/provider";

/** Tries a connection with the form's in-progress values — lets someone confirm a provider works before saving it. If apiKey is omitted, falls back to whatever key is already saved (e.g. testing after only changing the model). */
export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as { companyId?: string; baseUrl?: string; model?: string; apiKey?: string };
  if (!body.companyId || !body.baseUrl?.trim() || !body.model?.trim()) {
    return NextResponse.json({ error: "baseUrl and model are required" }, { status: 400 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId: body.companyId, action: "ai:configure" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to configure the AI provider" }, { status: 403 });
    }
    throw error;
  }

  let apiKey = body.apiKey?.trim() || undefined;
  if (!apiKey) {
    const existing = await getAiProviderSettings(prisma, body.companyId);
    apiKey = existing?.apiKey ?? undefined;
  }

  const result = await testConnection({ baseUrl: body.baseUrl.trim(), model: body.model.trim(), apiKey: apiKey ?? null });
  return NextResponse.json(result);
}
