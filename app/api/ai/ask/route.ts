import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize } from "@/lib/authz/service";
import { getAiProviderSettings } from "@/lib/ai/repository";
import { answerGuidanceQuestion } from "@/lib/ai/guidance-qa";
import { AiProviderError } from "@/lib/ai/provider";

export async function POST(request: NextRequest) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as { companyId?: string; question?: string };
  if (!body.companyId || !body.question?.trim()) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId: body.companyId, action: "ai:query" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted" }, { status: 403 });
    }
    throw error;
  }

  const settings = await getAiProviderSettings(prisma, body.companyId);
  if (!settings) {
    return NextResponse.json({ error: "No AI provider is configured for this company yet" }, { status: 400 });
  }

  try {
    const result = await answerGuidanceQuestion(prisma, settings, body.question.trim());
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AiProviderError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    throw error;
  }
}
