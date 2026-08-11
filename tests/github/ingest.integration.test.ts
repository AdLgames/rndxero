import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { ingestSuggestions } from "@/lib/github/ingest";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("ingestSuggestions (integration)", () => {
  let companyId: string;
  let projectId: string;
  let repoLinkId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Suggestion", "GithubRepoLink", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
    const project = await prisma.project.create({ data: { companyId, name: "Widget Engine", startDate: new Date() } });
    projectId = project.id;
    const repoLink = await prisma.githubRepoLink.create({
      data: { companyId, projectId, repoFullName: "acme/widgets", webhookSecret: "secret" },
    });
    repoLinkId = repoLink.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "Suggestion", "GithubRepoLink", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );
    await prisma.$disconnect();
  });

  it("creates a PENDING suggestion per parsed entry", async () => {
    await ingestSuggestions(prisma, {
      repoLinkId,
      projectId,
      suggestions: [{ externalRef: "sha1", summary: "Fix cache eviction" }],
    });

    const suggestions = await prisma.suggestion.findMany({ where: { repoLinkId } });
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({ externalRef: "sha1", summary: "Fix cache eviction", status: "PENDING" });
  });

  it("is idempotent on redelivery — the same externalRef does not duplicate", async () => {
    const suggestion = { externalRef: "sha1", summary: "Fix cache eviction" };
    await ingestSuggestions(prisma, { repoLinkId, projectId, suggestions: [suggestion] });
    await ingestSuggestions(prisma, { repoLinkId, projectId, suggestions: [suggestion] });

    const suggestions = await prisma.suggestion.findMany({ where: { repoLinkId } });
    expect(suggestions).toHaveLength(1);
  });
});
