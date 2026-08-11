import type { GithubRepoLink, PrismaClient, Suggestion } from "@/lib/generated/prisma/client";
import { generateWebhookSecret } from "@/lib/github/webhook";

export class SuggestionError extends Error {}

export async function createRepoLink(
  prisma: PrismaClient,
  params: { companyId: string; projectId: string; repoFullName: string }
): Promise<GithubRepoLink> {
  return prisma.githubRepoLink.create({
    data: {
      companyId: params.companyId,
      projectId: params.projectId,
      repoFullName: params.repoFullName,
      webhookSecret: generateWebhookSecret(),
    },
  });
}

/**
 * Confirming a suggestion is the one path that turns GitHub activity into
 * real evidence (BOARD-PLAN.md Phase 8.4). It attaches to the confirming
 * user's *existing* WeeklySubmission for the current week on this
 * project — it deliberately does not create one, so confirming a
 * suggestion never conjures a phantom 0-minute week that didn't happen;
 * if they haven't started this week's capture yet, they're told to do
 * that first.
 */
export async function confirmSuggestion(
  prisma: PrismaClient,
  params: { suggestionId: string; userId: string; weekKey: string; uncertaintyId: string; resolvedById: string }
): Promise<Suggestion> {
  const suggestion = await prisma.suggestion.findUnique({ where: { id: params.suggestionId } });
  if (!suggestion) throw new SuggestionError(`Suggestion ${params.suggestionId} not found`);
  if (suggestion.status !== "PENDING") throw new SuggestionError("Suggestion has already been resolved");

  const submission = await prisma.weeklySubmission.findUnique({
    where: { projectId_userId_weekKey: { projectId: suggestion.projectId, userId: params.userId, weekKey: params.weekKey } },
  });
  if (!submission) {
    throw new SuggestionError(`Log week ${params.weekKey} on this project first, then confirm the suggestion`);
  }
  if (submission.lockedAt !== null) {
    throw new SuggestionError("That week is sealed — confirm against an open week instead");
  }

  const uncertainty = await prisma.uncertainty.findUnique({ where: { id: params.uncertaintyId } });
  if (!uncertainty || uncertainty.projectId !== suggestion.projectId) {
    throw new SuggestionError("Uncertainty must belong to the same project as the suggestion");
  }

  const note = await prisma.uncertaintyNote.create({
    data: {
      submissionId: submission.id,
      uncertaintyId: params.uncertaintyId,
      type: "ATTEMPT",
      body: suggestion.summary,
    },
  });

  return prisma.suggestion.update({
    where: { id: suggestion.id },
    data: { status: "CONFIRMED", resolvedAt: new Date(), resolvedById: params.resolvedById, noteId: note.id },
  });
}

export async function dismissSuggestion(
  prisma: PrismaClient,
  params: { suggestionId: string; resolvedById: string }
): Promise<Suggestion> {
  const suggestion = await prisma.suggestion.findUnique({ where: { id: params.suggestionId } });
  if (!suggestion) throw new SuggestionError(`Suggestion ${params.suggestionId} not found`);
  if (suggestion.status !== "PENDING") throw new SuggestionError("Suggestion has already been resolved");

  return prisma.suggestion.update({
    where: { id: suggestion.id },
    data: { status: "DISMISSED", resolvedAt: new Date(), resolvedById: params.resolvedById },
  });
}
