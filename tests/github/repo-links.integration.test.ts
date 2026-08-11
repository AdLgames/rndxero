import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { confirmSuggestion, createRepoLink, dismissSuggestion, SuggestionError } from "@/lib/github/repo-links";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("github repo-links (integration)", () => {
  let companyId: string;
  let projectId: string;
  let userId: string;
  let uncertaintyId: string;
  let repoLinkId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Suggestion", "GithubRepoLink", "UncertaintyNote", "WeeklySubmission", "Uncertainty", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );
    const user = await prisma.user.create({ data: { email: "eng@example.com", name: "Eng" } });
    userId = user.id;
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
    const project = await prisma.project.create({ data: { companyId, name: "Widget Engine", startDate: new Date() } });
    projectId = project.id;
    const uncertainty = await prisma.uncertainty.create({
      data: { projectId, title: "Will the cache scale?", baseline: "b", raisedWeek: "2026-W33" },
    });
    uncertaintyId = uncertainty.id;
    const repoLink = await prisma.githubRepoLink.create({
      data: { companyId, projectId, repoFullName: "acme/widgets", webhookSecret: "secret" },
    });
    repoLinkId = repoLink.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Suggestion", "GithubRepoLink", "UncertaintyNote", "WeeklySubmission", "Uncertainty", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );
    await prisma.$disconnect();
  });

  describe("createRepoLink", () => {
    it("generates a fresh webhook secret", async () => {
      const link = await createRepoLink(prisma, { companyId, projectId, repoFullName: "acme/widgets-2" });
      expect(link.webhookSecret).toBeTruthy();
      expect(link.repoFullName).toBe("acme/widgets-2");
    });
  });

  describe("confirmSuggestion", () => {
    async function createSuggestion() {
      return prisma.suggestion.create({
        data: { repoLinkId, projectId, externalRef: "sha1", summary: "Fixed cache eviction" },
      });
    }

    it("requires an existing WeeklySubmission for that user/week — refuses to create one", async () => {
      const suggestion = await createSuggestion();
      await expect(
        confirmSuggestion(prisma, { suggestionId: suggestion.id, userId, weekKey: "2026-W33", uncertaintyId, resolvedById: userId })
      ).rejects.toThrow(/Log week/);
    });

    it("creates an UncertaintyNote and marks the suggestion CONFIRMED once a submission exists", async () => {
      await prisma.weeklySubmission.create({
        data: { companyId, projectId, userId, weekKey: "2026-W33", minutes: 120, basis: "ESTIMATED", isRetrospective: false },
      });
      const suggestion = await createSuggestion();

      const resolved = await confirmSuggestion(prisma, {
        suggestionId: suggestion.id,
        userId,
        weekKey: "2026-W33",
        uncertaintyId,
        resolvedById: userId,
      });

      expect(resolved.status).toBe("CONFIRMED");
      expect(resolved.noteId).not.toBeNull();
      const note = await prisma.uncertaintyNote.findUniqueOrThrow({ where: { id: resolved.noteId! } });
      expect(note.body).toBe("Fixed cache eviction");
      expect(note.type).toBe("ATTEMPT");
      expect(note.uncertaintyId).toBe(uncertaintyId);
    });

    it("refuses to confirm against a locked week", async () => {
      await prisma.weeklySubmission.create({
        data: { companyId, projectId, userId, weekKey: "2026-W33", minutes: 120, basis: "ESTIMATED", isRetrospective: false, lockedAt: new Date() },
      });
      const suggestion = await createSuggestion();

      await expect(
        confirmSuggestion(prisma, { suggestionId: suggestion.id, userId, weekKey: "2026-W33", uncertaintyId, resolvedById: userId })
      ).rejects.toThrow(/sealed/);
    });

    it("refuses to confirm into an uncertainty from a different project", async () => {
      await prisma.weeklySubmission.create({
        data: { companyId, projectId, userId, weekKey: "2026-W33", minutes: 120, basis: "ESTIMATED", isRetrospective: false },
      });
      const otherProject = await prisma.project.create({ data: { companyId, name: "Other", startDate: new Date() } });
      const foreignUncertainty = await prisma.uncertainty.create({
        data: { projectId: otherProject.id, title: "Foreign", baseline: "b", raisedWeek: "2026-W33" },
      });
      const suggestion = await createSuggestion();

      await expect(
        confirmSuggestion(prisma, { suggestionId: suggestion.id, userId, weekKey: "2026-W33", uncertaintyId: foreignUncertainty.id, resolvedById: userId })
      ).rejects.toThrow(SuggestionError);
    });

    it("refuses to confirm a suggestion that's already resolved", async () => {
      await prisma.weeklySubmission.create({
        data: { companyId, projectId, userId, weekKey: "2026-W33", minutes: 120, basis: "ESTIMATED", isRetrospective: false },
      });
      const suggestion = await createSuggestion();
      await dismissSuggestion(prisma, { suggestionId: suggestion.id, resolvedById: userId });

      await expect(
        confirmSuggestion(prisma, { suggestionId: suggestion.id, userId, weekKey: "2026-W33", uncertaintyId, resolvedById: userId })
      ).rejects.toThrow(/already been resolved/);
    });
  });

  describe("dismissSuggestion", () => {
    it("marks a PENDING suggestion DISMISSED without creating a note", async () => {
      const suggestion = await prisma.suggestion.create({
        data: { repoLinkId, projectId, externalRef: "sha1", summary: "Noise commit" },
      });

      const resolved = await dismissSuggestion(prisma, { suggestionId: suggestion.id, resolvedById: userId });
      expect(resolved.status).toBe("DISMISSED");
      expect(resolved.noteId).toBeNull();
      expect(await prisma.uncertaintyNote.count()).toBe(0);
    });

    it("refuses to dismiss an already-resolved suggestion", async () => {
      const suggestion = await prisma.suggestion.create({
        data: { repoLinkId, projectId, externalRef: "sha1", summary: "x" },
      });
      await dismissSuggestion(prisma, { suggestionId: suggestion.id, resolvedById: userId });

      await expect(dismissSuggestion(prisma, { suggestionId: suggestion.id, resolvedById: userId })).rejects.toThrow(
        SuggestionError
      );
    });
  });
});
