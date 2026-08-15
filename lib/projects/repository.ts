import type { PrismaClient, Project, ProjectCompetentProfessional, ProjectStatus, QualificationStatus } from "@/lib/generated/prisma/client";
import { writeAuditLog } from "@/lib/locking/audit";

/**
 * Projects are the unit everything else (evidence, time, cost, export)
 * hangs off. Competent professionals are named at creation time and stay
 * fixed after that — so a project can't exist without at least one named,
 * matching PLAN.md's evidence-pack requirement to always have one to show.
 * Description, status, and the AIF-related fields below are editable
 * post-creation; name, dates, and competent professionals stay fixed at
 * what was recorded when the project was created.
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

export interface UpdateProjectInput {
  projectId: string;
  companyId: string;
  actorId: string;
  description?: string | null;
  status?: ProjectStatus;
  fieldOfScienceOrTechnology?: string | null;
  advanceSought?: string | null;
  qualificationStatus?: QualificationStatus;
}

/** A partial update — only the fields present in `input` are touched, so callers can PATCH one field (e.g. just status) without clobbering the others. Logs before/after to AuditLog. */
export async function updateProject(prisma: PrismaClient, input: UpdateProjectInput): Promise<Project> {
  const { projectId, companyId, actorId, ...data } = input;
  const before = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const after = await prisma.project.update({ where: { id: projectId }, data });

  await writeAuditLog(prisma, {
    companyId,
    actorId,
    action: "project:update",
    entityType: "Project",
    entityId: projectId,
    before: Object.fromEntries(Object.keys(data).map((key) => [key, before[key as keyof Project]])),
    after: Object.fromEntries(Object.keys(data).map((key) => [key, after[key as keyof Project]])),
  });

  return after;
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
