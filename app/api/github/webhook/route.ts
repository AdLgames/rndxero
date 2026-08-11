import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyGithubSignature } from "@/lib/github/webhook";
import { ingestSuggestions, parseGithubEvent } from "@/lib/github/ingest";

interface GithubRepositoryPayload {
  repository?: { full_name?: string };
}

/**
 * GitHub App webhook receiver (BOARD-PLAN.md Phase 8.4) — no session,
 * GitHub is the caller. Authenticity comes entirely from the per-repo
 * HMAC signature (verifyGithubSignature), checked against the raw body
 * text before it's parsed as JSON — signing the parsed-and-reserialized
 * form would silently accept a payload GitHub never actually sent if
 * JSON.stringify ever produced different bytes than what was signed.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  let payload: GithubRepositoryPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const repoFullName = payload.repository?.full_name;
  if (!repoFullName) {
    return NextResponse.json({ error: "Payload has no repository.full_name" }, { status: 400 });
  }

  const repoLink = await prisma.githubRepoLink.findUnique({ where: { repoFullName } });
  if (!repoLink) {
    return NextResponse.json({ error: "No project linked to this repository" }, { status: 404 });
  }

  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyGithubSignature(rawBody, signature, repoLink.webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const eventType = request.headers.get("x-github-event") ?? "";
  const suggestions = parseGithubEvent(eventType, payload);
  const result = await ingestSuggestions(prisma, { repoLinkId: repoLink.id, projectId: repoLink.projectId, suggestions });

  return NextResponse.json(result);
}
