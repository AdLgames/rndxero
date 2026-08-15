import type { PrismaClient } from "@/lib/generated/prisma/client";
import { writeAuditLog } from "@/lib/locking/audit";

export class BoardError extends Error {}

/**
 * "Drag-to-remap" (BOARD-PLAN.md Phase 6.7): reassigns a live note to a
 * different uncertainty within the same project and writes the change to
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
