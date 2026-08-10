/**
 * Pure approval state machine. No persistence, no framework coupling —
 * see lib/evidence/repository.ts for how decisions get written down
 * (as new, append-only Approval rows).
 *
 * A target (a TimeEntry, CostAllocation, or PeriodSnapshot) starts
 * `pending`. Finance can `approve` or `query` it. A queried item must be
 * corrected and `resubmit`ted before it can be approved — finance cannot
 * approve a query away, and once `approved` a target is terminal: any
 * further correction is a new evidence/time/cost entry that supersedes
 * the old one and starts its own pending approval, not a reopening of
 * this one.
 */

export type ApprovalStatus = "pending" | "approved" | "queried";
export type ApprovalAction = "approve" | "query" | "resubmit";

const TRANSITIONS: Record<ApprovalStatus, Partial<Record<ApprovalAction, ApprovalStatus>>> = {
  pending: { approve: "approved", query: "queried" },
  queried: { resubmit: "pending" },
  approved: {},
};

export class InvalidApprovalTransitionError extends Error {
  constructor(from: ApprovalStatus, action: ApprovalAction) {
    super(`Cannot ${action} an approval that is ${from}`);
    this.name = "InvalidApprovalTransitionError";
  }
}

export function transition(from: ApprovalStatus, action: ApprovalAction): ApprovalStatus {
  const next = TRANSITIONS[from][action];
  if (!next) {
    throw new InvalidApprovalTransitionError(from, action);
  }
  return next;
}

export function canTransition(from: ApprovalStatus, action: ApprovalAction): boolean {
  return TRANSITIONS[from][action] !== undefined;
}
