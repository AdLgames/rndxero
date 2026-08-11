import type { PrismaClient, Project, ProjectCompetentProfessional } from "@/lib/generated/prisma/client";

/**
 * Projects are the unit everything else (evidence, time, cost, export)
 * hangs off. Competent professionals are named at creation time — this
 * is the only place they're set, since there's no edit-project flow yet
 * — so a project can't exist without at least one named, matching
 * PLAN.md's evidence-pack requirement to always have one to show.
 */
export interface CreateProjectInput {
  companyId: string;
  name: string;
  startDate: Date;
  endDate?: Date | null;
  competentProfessionals: string[];
}

export async function createProject(
  prisma: PrismaClient,
  input: CreateProjectInput
): Promise<Project & { competentProfessionals: ProjectCompetentProfessional[] }> {
  const names = [...new Set(input.competentProfessionals.map((name) => name.trim()).filter(Boolean))];
  if (names.length === 0) {
    throw new Error("At least one competent professional must be named");
  }

  return prisma.project.create({
    data: {
      companyId: input.companyId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      competentProfessionals: { create: names.map((name) => ({ name })) },
    },
    include: { competentProfessionals: true },
  });
}

export async function listCompanyProjects(
  prisma: PrismaClient,
  companyId: string
): Promise<Array<Project & { competentProfessionals: ProjectCompetentProfessional[] }>> {
  return prisma.project.findMany({
    where: { companyId },
    include: { competentProfessionals: true },
    orderBy: { createdAt: "desc" },
  });
}
