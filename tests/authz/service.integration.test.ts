import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { authorize, AuthorizationError, canDo, resolveSubject } from "@/lib/authz/service";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("authz service (integration)", () => {
  let companyId: string;
  let projectAId: string;
  let projectBId: string;
  let ownerId: string;
  let contributorId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "ProjectMember", "Membership", "Rate", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );

    const owner = await prisma.user.create({ data: { email: "owner@example.com", name: "Owner" } });
    ownerId = owner.id;
    const contributor = await prisma.user.create({ data: { email: "contrib@example.com", name: "Contrib" } });
    contributorId = contributor.id;

    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;

    await prisma.membership.create({
      data: { userId: ownerId, companyId, role: "OWNER", status: "ACTIVE" },
    });
    await prisma.membership.create({
      data: { userId: contributorId, companyId, role: "CONTRIBUTOR", status: "ACTIVE" },
    });

    const projectA = await prisma.project.create({
      data: { companyId, name: "Project A", startDate: new Date() },
    });
    projectAId = projectA.id;
    const projectB = await prisma.project.create({
      data: { companyId, name: "Project B", startDate: new Date() },
    });
    projectBId = projectB.id;

    // Contributor is only a member of Project A, not B.
    await prisma.projectMember.create({
      data: { projectId: projectAId, userId: contributorId, role: "CONTRIBUTOR" },
    });

    await prisma.rate.create({
      data: { companyId, userId: contributorId, hourlyRateMinorUnits: 5000, effectiveFrom: new Date() },
    });
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "ProjectMember", "Membership", "Rate", "Project", "Company", "User" RESTART IDENTITY CASCADE'
    );
    await prisma.$disconnect();
  });

  it("resolves a subject from real Membership/ProjectMember rows", async () => {
    const subject = await resolveSubject(prisma, { userId: contributorId, companyId, projectId: projectAId });
    expect(subject).toMatchObject({
      companyRole: "CONTRIBUTOR",
      companyStatus: "ACTIVE",
      canViewCosts: false,
      projectRole: "CONTRIBUTOR",
    });
  });

  it("resolves no membership at all for a user outside the company", async () => {
    const stranger = await prisma.user.create({ data: { email: "stranger@example.com", name: "Stranger" } });
    const subject = await resolveSubject(prisma, { userId: stranger.id, companyId });
    expect(subject.companyRole).toBeNull();
  });

  describe("'done when': a contributor's session provably cannot read a rate", () => {
    it("canDo returns false", async () => {
      const allowed = await canDo(prisma, { userId: contributorId, companyId, action: "rate:read" });
      expect(allowed).toBe(false);
    });

    it("authorize throws AuthorizationError", async () => {
      await expect(
        authorize(prisma, { userId: contributorId, companyId, action: "rate:read" })
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe("'done when': a contributor's session provably cannot read another project's board", () => {
    it("canDo returns false for the project they are not on", async () => {
      const allowed = await canDo(prisma, {
        userId: contributorId,
        companyId,
        projectId: projectBId,
        action: "project:read",
      });
      expect(allowed).toBe(false);
    });

    it("canDo returns true for the project they ARE on", async () => {
      const allowed = await canDo(prisma, {
        userId: contributorId,
        companyId,
        projectId: projectAId,
        action: "project:read",
      });
      expect(allowed).toBe(true);
    });
  });

  it("an Owner can read a rate and any project without being a ProjectMember", async () => {
    expect(await canDo(prisma, { userId: ownerId, companyId, action: "rate:read" })).toBe(true);
    expect(
      await canDo(prisma, { userId: ownerId, companyId, projectId: projectBId, action: "project:read" })
    ).toBe(true);
  });
});
