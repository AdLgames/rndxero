import type {
  PrismaClient,
  SubmissionBasis,
  Uncertainty,
  UncertaintyNoteType,
  WeeklySubmission,
} from "@/lib/generated/prisma/client";
import { isRetrospective as computeIsRetrospective } from "@/lib/capture/week-key";

/**
 * The previous week's minutes for this person on this project, if any —
 * BOARD-PLAN.md Phase 3.3's prefill. Never rendered as a claim of what
 * they did this week, just a starting point to correct or accept.
 */
export async function getPrefillMinutes(
  prisma: PrismaClient,
  params: { projectId: string; userId: string; previousWeekKey: string }
): Promise<number | null> {
  const previous = await prisma.weeklySubmission.findUnique({
    where: {
      projectId_userId_weekKey: {
        projectId: params.projectId,
        userId: params.userId,
        weekKey: params.previousWeekKey,
      },
    },
  });
  return previous?.minutes ?? null;
}

export async function getOpenUncertainties(prisma: PrismaClient, projectId: string): Promise<Uncertainty[]> {
  return prisma.uncertainty.findMany({
    where: { projectId, outcome: "OPEN" },
    orderBy: { createdAt: "asc" },
  });
}

export interface CreateUncertaintyInput {
  projectId: string;
  title: string;
  baseline: string;
  description?: string;
  weekKey: string;
}

/** The only place a title + baseline is genuinely required typing (Phase 3.5). */
export async function createUncertainty(prisma: PrismaClient, input: CreateUncertaintyInput): Promise<Uncertainty> {
  return prisma.uncertainty.create({
    data: {
      projectId: input.projectId,
      title: input.title,
      baseline: input.baseline,
      description: input.description,
      raisedWeek: input.weekKey,
    },
  });
}

export interface NoteInput {
  uncertaintyId: string;
  type: UncertaintyNoteType;
  body: string;
  minutes?: number;
}

export interface SubmitWeekInput {
  companyId: string;
  projectId: string;
  userId: string;
  weekKey: string;
  minutes: number;
  basis: SubmissionBasis;
  notes: NoteInput[];
}

/**
 * One person, one project, one week. Idempotent by design (the schema's
 * unique constraint is on exactly this triple): submitting again for the
 * same week updates the existing row rather than erroring, since a
 * person may reasonably touch a week's capture more than once before it
 * locks. `submittedAt`/`isRetrospective` are set once, on first creation,
 * and never rewritten by a later correction — they answer "was this
 * written at the time," which is a fact about when the week was first
 * engaged with, not about its most recent edit.
 */
export async function submitWeek(
  prisma: PrismaClient,
  input: SubmitWeekInput
): Promise<WeeklySubmission> {
  const now = new Date();
  const submission = await prisma.weeklySubmission.upsert({
    where: {
      projectId_userId_weekKey: { projectId: input.projectId, userId: input.userId, weekKey: input.weekKey },
    },
    update: {
      minutes: input.minutes,
      basis: input.basis,
    },
    create: {
      companyId: input.companyId,
      projectId: input.projectId,
      userId: input.userId,
      weekKey: input.weekKey,
      minutes: input.minutes,
      basis: input.basis,
      submittedAt: now,
      isRetrospective: computeIsRetrospective(now, input.weekKey),
    },
  });

  if (input.notes.length > 0) {
    await prisma.uncertaintyNote.createMany({
      data: input.notes.map((note) => ({
        submissionId: submission.id,
        uncertaintyId: note.uncertaintyId,
        type: note.type,
        body: note.body,
        minutes: note.minutes,
      })),
    });
  }

  return submission;
}

export interface CaptureSnapshot {
  weeksLogged: number;
  openUncertainties: number;
  totalMinutes: number;
}

/** "Confirmation state... the running record" (Phase 3.7). */
export async function getCaptureSnapshot(
  prisma: PrismaClient,
  params: { projectId: string; userId: string }
): Promise<CaptureSnapshot> {
  const [submissions, openUncertainties] = await Promise.all([
    prisma.weeklySubmission.findMany({ where: { projectId: params.projectId, userId: params.userId } }),
    prisma.uncertainty.count({ where: { projectId: params.projectId, outcome: "OPEN" } }),
  ]);

  return {
    weeksLogged: submissions.length,
    openUncertainties,
    totalMinutes: submissions.reduce((sum, s) => sum + s.minutes, 0),
  };
}
