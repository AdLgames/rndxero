import type { PrismaClient } from "@/lib/generated/prisma/client";

export interface ParsedSuggestion {
  externalRef: string;
  summary: string;
}

interface GithubPushPayload {
  commits?: Array<{ id: string; message: string }>;
}

interface GithubPullRequestPayload {
  action?: string;
  pull_request?: { number: number; title: string };
}

/**
 * Pure parsing — no database, no network (BOARD-PLAN.md Phase 8.4:
 * "suggestion only, human confirms"). Every commit on a push, and every
 * newly-opened PR, becomes a candidate; nothing here decides which
 * uncertainty it belongs to or whether it's evidence at all — that's the
 * human's call in the confirm step, not this function's.
 */
export function parseGithubEvent(eventType: string, payload: unknown): ParsedSuggestion[] {
  if (eventType === "push") {
    const commits = (payload as GithubPushPayload).commits ?? [];
    return commits.map((commit) => ({
      externalRef: commit.id,
      summary: commit.message.split("\n")[0].slice(0, 500),
    }));
  }

  if (eventType === "pull_request") {
    const body = payload as GithubPullRequestPayload;
    if (body.action !== "opened" || !body.pull_request) return [];
    return [
      {
        externalRef: `pr-${body.pull_request.number}`,
        summary: `PR #${body.pull_request.number}: ${body.pull_request.title}`.slice(0, 500),
      },
    ];
  }

  return [];
}

/**
 * Persists parsed suggestions as PENDING rows, idempotently — GitHub
 * redelivers webhooks on timeout/error, and upserting on the
 * (repoLinkId, externalRef) unique key means a redelivery is a no-op
 * rather than a duplicate suggestion.
 */
export async function ingestSuggestions(
  prisma: PrismaClient,
  params: { repoLinkId: string; projectId: string; suggestions: ParsedSuggestion[] }
): Promise<{ ingested: number }> {
  for (const suggestion of params.suggestions) {
    await prisma.suggestion.upsert({
      where: { repoLinkId_externalRef: { repoLinkId: params.repoLinkId, externalRef: suggestion.externalRef } },
      update: {},
      create: {
        repoLinkId: params.repoLinkId,
        projectId: params.projectId,
        externalRef: suggestion.externalRef,
        summary: suggestion.summary,
      },
    });
  }
  return { ingested: params.suggestions.length };
}
