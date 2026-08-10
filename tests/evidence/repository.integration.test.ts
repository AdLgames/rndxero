import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  getProjectEvidenceLog,
  recordEvidenceEntry,
  supersedeEvidenceEntry,
} from "@/lib/evidence/repository";

/**
 * Integration tests against a real Postgres instance (DATABASE_URL). These
 * prove the things a mocked/in-memory test cannot: that the append-only
 * database trigger from the evidence_model migration actually rejects
 * UPDATE and DELETE, not just that our repository code chooses not to
 * issue them. Skipped automatically when no database is configured.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("evidence repository (integration)", () => {
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    // TRUNCATE bypasses per-row triggers (unlike DELETE), so this is the
    // one safe way to reset append-only tables between test runs.
    await prisma.$executeRawUnsafe(
      'TRUNCATE "EvidenceEntry", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );

    const user = await prisma.user.create({
      data: { email: "engineer@example.com", name: "Test Engineer" },
    });
    userId = user.id;

    const company = await prisma.company.create({ data: { name: "Test Co" } });
    const project = await prisma.project.create({
      data: { companyId: company.id, name: "Test Project", startDate: new Date() },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "EvidenceEntry", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );
    await prisma.$disconnect();
  });

  it("records an entry via insert only", async () => {
    const entry = await recordEvidenceEntry(prisma, {
      projectId,
      type: "UNCERTAINTY_RAISED",
      body: "Not sure the batching approach will hold under load.",
      authorId: userId,
    });

    expect(entry.id).toBeDefined();
    expect(entry.supersedes).toBeNull();
  });

  it("rejects a direct UPDATE against EvidenceEntry", async () => {
    const entry = await recordEvidenceEntry(prisma, {
      projectId,
      type: "UNCERTAINTY_RAISED",
      body: "original",
      authorId: userId,
    });

    await expect(
      prisma.$executeRawUnsafe(`UPDATE "EvidenceEntry" SET body = 'rewritten' WHERE id = $1`, entry.id)
    ).rejects.toThrow(/append-only violation/);
  });

  it("rejects a direct DELETE against EvidenceEntry", async () => {
    const entry = await recordEvidenceEntry(prisma, {
      projectId,
      type: "UNCERTAINTY_RAISED",
      body: "original",
      authorId: userId,
    });

    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "EvidenceEntry" WHERE id = $1`, entry.id)
    ).rejects.toThrow(/append-only violation/);
  });

  it("supersede leaves the original row untouched and links a new one", async () => {
    const original = await recordEvidenceEntry(prisma, {
      projectId,
      type: "UNCERTAINTY_RAISED",
      body: "Not sure the batching approach will hold under load.",
      authorId: userId,
    });

    const correction = await supersedeEvidenceEntry(prisma, {
      supersededId: original.id,
      type: "RESOLUTION",
      body: "Confirmed batching holds; verified under 10x load in staging.",
      authorId: userId,
    });

    const log = await getProjectEvidenceLog(prisma, projectId);

    expect(log).toHaveLength(2);
    const persistedOriginal = log.find((e) => e.id === original.id);
    expect(persistedOriginal?.body).toBe(
      "Not sure the batching approach will hold under load."
    );
    expect(correction.supersedes).toBe(original.id);
  });

  it("throws when superseding an id that does not exist", async () => {
    await expect(
      supersedeEvidenceEntry(prisma, {
        supersededId: "does-not-exist",
        type: "RESOLUTION",
        body: "n/a",
        authorId: userId,
      })
    ).rejects.toThrow(/unknown evidence entry/);
  });
});
