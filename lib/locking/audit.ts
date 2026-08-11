import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * The single place locking-related actions write to AuditLog
 * (BOARD-PLAN.md Phase 1.6: "from a single service wrapper... not from
 * individual route handlers, or coverage will rot within a month").
 * AuditLog itself is insert-only at the database level; this just shapes
 * the row consistently.
 */
export interface WriteAuditLogInput {
  companyId: string;
  /** Null for a system-initiated action (e.g. auto-lock) — see lib/locking/repository.ts's autoLockOverdueSubmissions. */
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
}

export async function writeAuditLog(prisma: PrismaClient, input: WriteAuditLogInput) {
  return prisma.auditLog.create({
    data: {
      companyId: input.companyId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before === undefined ? undefined : JSON.parse(JSON.stringify(input.before)),
      after: input.after === undefined ? undefined : JSON.parse(JSON.stringify(input.after)),
      reason: input.reason,
    },
  });
}
