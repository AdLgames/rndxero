import type { PrismaClient, UncertaintyNoteType } from "@/lib/generated/prisma/client";
import { shiftWeekKey } from "@/lib/capture/week-key";
import { getCurrentPlanVersion } from "@/lib/plan/repository";
import { writeAuditLog } from "@/lib/locking/audit";

export class BoardError extends Error {}

export interface BoardNote {
  id: string;
  type: UncertaintyNoteType;
  bodyPreview: string;
  uncertaintyId: string;
  uncertaintyTitle: string;
  locked: boolean;
}

export interface BoardLane {
  projectId: string;
  projectName: string;
  startDate: string;
  endDate: string | null;
  plannedMinutesByWeek: Record<string, number>;
  actualMinutesByWeek: Record<string, number>;
  notesByWeek: Record<string, BoardNote[]>;
}

export interface BoardData {
  weekKeys: string[];
  lanes: BoardLane[];
}

/**
 * The board's data for one company (BOARD-PLAN.md Phase 6.1: lanes are
 * project workstreams per the Phase 0 decision, columns are ISO weeks).
 * `weekCount` includes `fromWeekKey` itself. Empty weeks are represented
 * by their key simply being absent from a lane's per-week maps — the
 * caller renders that as a visible gap (Phase 6.9) rather than the
 * repository inventing zero-rows for weeks nothing touched.
 */
export async function getBoardData(
  prisma: PrismaClient,
  params: { companyId: string; projectIds: string[]; fromWeekKey: string; weekCount: number }
): Promise<BoardData> {
  const weekKeys = Array.from({ length: params.weekCount }, (_, i) => shiftWeekKey(params.fromWeekKey, i));
  const weekKeySet = new Set(weekKeys);

  const projects = await prisma.project.findMany({
    where: { id: { in: params.projectIds }, companyId: params.companyId },
    orderBy: { name: "asc" },
  });

  const submissions = await prisma.weeklySubmission.findMany({
    where: { projectId: { in: params.projectIds }, weekKey: { in: weekKeys } },
    include: {
      notes: { include: { uncertainty: { select: { id: true, title: true } } } },
    },
  });

  const plansByProject = new Map(
    await Promise.all(
      params.projectIds.map(async (projectId) => [projectId, await getCurrentPlanVersion(prisma, projectId)] as const)
    )
  );

  const lanes: BoardLane[] = projects.map((project) => {
    const plannedMinutesByWeek: Record<string, number> = {};
    const currentPlan = plansByProject.get(project.id);
    for (const allocation of currentPlan?.plannedAllocations ?? []) {
      if (!weekKeySet.has(allocation.weekKey)) continue;
      plannedMinutesByWeek[allocation.weekKey] = (plannedMinutesByWeek[allocation.weekKey] ?? 0) + allocation.plannedMinutes;
    }

    const actualMinutesByWeek: Record<string, number> = {};
    const notesByWeek: Record<string, BoardNote[]> = {};
    for (const submission of submissions) {
      if (submission.projectId !== project.id) continue;
      actualMinutesByWeek[submission.weekKey] = (actualMinutesByWeek[submission.weekKey] ?? 0) + submission.minutes;

      const locked = submission.lockedAt !== null;
      const notes = submission.notes.map((note) => ({
        id: note.id,
        type: note.type,
        bodyPreview: note.body.length > 80 ? `${note.body.slice(0, 80)}…` : note.body,
        uncertaintyId: note.uncertaintyId,
        uncertaintyTitle: note.uncertainty.title,
        locked,
      }));
      if (notes.length > 0) {
        notesByWeek[submission.weekKey] = [...(notesByWeek[submission.weekKey] ?? []), ...notes];
      }
    }

    return {
      projectId: project.id,
      projectName: project.name,
      startDate: project.startDate.toISOString(),
      endDate: project.endDate ? project.endDate.toISOString() : null,
      plannedMinutesByWeek,
      actualMinutesByWeek,
      notesByWeek,
    };
  });

  return { weekKeys, lanes };
}

/**
 * "Drag-to-remap" (Phase 6.7): reassigns a live note to a different
 * uncertainty within the same project and writes the change to
 * AuditLog. The DB's `uncertainty_note_lock_guard` trigger already
 * refuses this once the note's parent submission is locked — this just
 * turns that into a legible error instead of a raw constraint failure,
 * and makes sure the audit trail captures which uncertainty it moved
 * from and to.
 */
export async function remapNote(
  prisma: PrismaClient,
  params: { noteId: string; companyId: string; actorId: string; toUncertaintyId: string }
) {
  const note = await prisma.uncertaintyNote.findUnique({
    where: { id: params.noteId },
    include: { submission: true },
  });
  if (!note) {
    throw new BoardError(`Note ${params.noteId} not found`);
  }
  if (note.submission.lockedAt !== null) {
    throw new BoardError("This note's week is locked — remapping needs an amendment instead");
  }
  if (note.uncertaintyId === params.toUncertaintyId) {
    return note;
  }

  const toUncertainty = await prisma.uncertainty.findUnique({ where: { id: params.toUncertaintyId } });
  if (!toUncertainty || toUncertainty.projectId !== note.submission.projectId) {
    throw new BoardError("Target uncertainty must belong to the same project");
  }

  const updated = await prisma.uncertaintyNote.update({
    where: { id: params.noteId },
    data: { uncertaintyId: params.toUncertaintyId },
  });

  await writeAuditLog(prisma, {
    companyId: params.companyId,
    actorId: params.actorId,
    action: "note.remap",
    entityType: "UncertaintyNote",
    entityId: note.id,
    before: { uncertaintyId: note.uncertaintyId },
    after: { uncertaintyId: updated.uncertaintyId },
  });

  return updated;
}
