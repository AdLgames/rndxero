import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { upsertAiProviderConfig } from "@/lib/ai/repository";

export async function PATCH(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as {
    companyId?: string;
    label?: string;
    baseUrl?: string;
    model?: string;
    apiKey?: string | null;
  };
  if (!body.companyId || !body.label?.trim() || !body.baseUrl?.trim() || !body.model?.trim()) {
    return NextResponse.json({ error: "label, baseUrl, and model are required" }, { status: 400 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId: body.companyId, action: "ai:configure" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to configure the AI provider" }, { status: 403 });
    }
    throw error;
  }

  try {
    new URL(body.baseUrl);
  } catch {
    return NextResponse.json({ error: "baseUrl must be a valid URL" }, { status: 400 });
  }

  const config = await upsertAiProviderConfig(prisma, {
    companyId: body.companyId,
    createdById: currentUser.id,
    label: body.label.trim(),
    baseUrl: body.baseUrl.trim(),
    model: body.model.trim(),
    apiKey: body.apiKey === undefined ? undefined : body.apiKey === null || body.apiKey === "" ? null : body.apiKey,
  });

  return NextResponse.json({ config });
}
