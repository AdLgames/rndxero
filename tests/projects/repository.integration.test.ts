import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createProject, listCompanyProjects } from "@/lib/projects/repository";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("project repository (integration)", () => {
  let companyId: string;

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "ProjectCompetentProfessional", "Project", "Company" RESTART IDENTITY CASCADE'
    );
    const company = await prisma.company.create({ data: { name: "Test Co" } });
    companyId = company.id;
  });

  afterAll(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE "ProjectCompetentProfessional", "Project", "Company" RESTART IDENTITY CASCADE'
    );
    await prisma.$disconnect();
  });

  it("creates a project with its named competent professionals", async () => {
    const project = await createProject(prisma, {
      companyId,
      name: "Batching engine",
      startDate: new Date("2026-01-01"),
      competentProfessionals: ["Dr. Ada Lovelace", "Bo Chen"],
    });

    expect(project.name).toBe("Batching engine");
    expect(project.competentProfessionals.map((cp) => cp.name).sort()).toEqual([
      "Bo Chen",
      "Dr. Ada Lovelace",
    ]);
  });

  it("de-duplicates and trims competent professional names", async () => {
    const project = await createProject(prisma, {
      companyId,
      name: "Batching engine",
      startDate: new Date("2026-01-01"),
      competentProfessionals: [" Ada ", "Ada", "Bo"],
    });

    expect(project.competentProfessionals.map((cp) => cp.name).sort()).toEqual(["Ada", "Bo"]);
  });

  it("rejects a project with no named competent professional", async () => {
    await expect(
      createProject(prisma, {
        companyId,
        name: "Batching engine",
        startDate: new Date("2026-01-01"),
        competentProfessionals: ["  ", ""],
      })
    ).rejects.toThrow(/At least one competent professional/);
  });

  it("lists a company's projects newest first", async () => {
    const first = await createProject(prisma, {
      companyId,
      name: "First",
      startDate: new Date("2026-01-01"),
      competentProfessionals: ["Ada"],
    });
    const second = await createProject(prisma, {
      companyId,
      name: "Second",
      startDate: new Date("2026-01-01"),
      competentProfessionals: ["Ada"],
    });

    const projects = await listCompanyProjects(prisma, companyId);

    expect(projects.map((p) => p.id)).toEqual([second.id, first.id]);
  });
});
