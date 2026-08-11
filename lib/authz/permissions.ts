import type { Action, AuthzSubject, ResourceContext } from "@/lib/authz/types";

/**
 * The permission matrix, in one file, exactly as specified (BOARD-PLAN.md
 * Phase 2):
 *
 *   Owner:       everything, plus billing and membership.
 *   Finance:     rates, approve/lock weeks, all costs, export claim pack.
 *                Cannot edit submissions.
 *   Lead:        create uncertainties, own the plan, invite contributors
 *                to their projects, see hours. Costs only if canViewCosts.
 *   Contributor: submit own capture, read the board for projects they're
 *                on. No rates, no other users' costs.
 *   Adviser:     read-only on shared projects, plus export. Submits
 *                nothing, edits nothing.
 *
 * Costs-gated actions (rate:read, cost:read) additionally require
 * canViewCosts for every role except Owner/Finance, who always have it —
 * canViewCosts is a company policy flag, not something a role can grant
 * itself.
 */
const ROLE_ACTIONS: Record<AuthzSubject["companyRole"] & string, ReadonlySet<Action>> = {
  OWNER: new Set<Action>([
    "billing:manage",
    "membership:manage",
    "project:create",
    "project:read",
    "project:update",
    "projectMember:invite",
    "uncertainty:create",
    "uncertainty:read",
    "uncertainty:update",
    "submission:create",
    "submission:read",
    "submission:update",
    "submission:amend",
    "submission:lock",
    "submission:unlock",
    "note:create",
    "note:read",
    "note:update",
    "note:amend",
    "note:remap",
    "rate:read",
    "rate:write",
    "cost:read",
    "cost:write",
    "plan:read",
    "plan:write",
    "export:read",
  ]),
  FINANCE: new Set<Action>([
    "project:read",
    "uncertainty:read",
    "submission:read",
    "submission:amend",
    "submission:lock",
    "submission:unlock",
    "note:read",
    "note:amend",
    "rate:read",
    "rate:write",
    "cost:read",
    "cost:write",
    "plan:read",
    "export:read",
    // Deliberately absent: submission:update, note:update, submission:create,
    // note:create, project:create, uncertainty:create/update, membership/billing.
    // "Cannot edit submissions" is explicit in the spec — Finance locks and
    // amends, never directly edits.
  ]),
  LEAD: new Set<Action>([
    "project:read",
    "uncertainty:create",
    "uncertainty:read",
    "uncertainty:update",
    "projectMember:invite",
    "submission:create",
    "submission:read",
    "submission:update",
    "submission:amend",
    "cost:read",
    "note:create",
    "note:read",
    "note:update",
    "note:amend",
    "note:remap",
    "plan:read",
    "plan:write",
    // rate:*, export:read absent entirely — Lead never sees raw rates
    // (that's Finance's alone), only derived cost:read, and even that is
    // additionally gated on canViewCosts below.
  ]),
  CONTRIBUTOR: new Set<Action>([
    "project:read",
    "uncertainty:read",
    "submission:create",
    "submission:read",
    "submission:update",
    "note:create",
    "note:read",
    "note:update",
    // No rate:*, no cost:*, no plan:write, no export, no invite.
  ]),
  ADVISER: new Set<Action>([
    "project:read",
    "uncertainty:read",
    "submission:read",
    "note:read",
    "plan:read",
    "export:read",
    // "Submits nothing, edits nothing" — no create/update/amend of any kind.
  ]),
};

// Only cost:read is actually gate-eligible: rate:read/rate:write/cost:write
// never appear in any non-Owner/Finance role's action set at all (rates are
// Finance's alone, full stop — canViewCosts governs seeing *derived* cost,
// not raw pay rates), so those three would never reach this check regardless.
const COST_GATED_ACTIONS: ReadonlySet<Action> = new Set<Action>(["cost:read"]);

/** Actions that require project-level standing (a ProjectMember row), not just a company role. */
const PROJECT_SCOPED_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  "project:read",
  "project:update",
  "uncertainty:create",
  "uncertainty:read",
  "uncertainty:update",
  "submission:create",
  "submission:read",
  "submission:update",
  "submission:amend",
  "submission:lock",
  "submission:unlock",
  "note:create",
  "note:read",
  "note:update",
  "note:amend",
  "note:remap",
  "plan:read",
  "plan:write",
  "export:read",
]);

/** Actions restricted to acting on your own submission/note, no matter the role — see the hard rule below. */
const OWNERSHIP_RESTRICTED_ACTIONS: ReadonlySet<Action> = new Set<Action>(["submission:update", "note:update"]);

// note:remap (board Phase 6.7: "drag-to-remap") is deliberately absent from
// OWNERSHIP_RESTRICTED_ACTIONS — reassigning which uncertainty a note sits
// under is a board-curation action a Lead does across the whole project,
// not a correction to their own capture, so it isn't limited to notes they
// personally wrote the way note:update is. It's still blocked once the
// note's parent submission is locked, by the same DB trigger that guards
// any other direct edit to a live note.

/**
 * Pure authorization check. No database access — the caller (typically
 * lib/authz/service.ts) resolves `subject` from Membership/ProjectMember
 * rows first. Kept pure specifically so the matrix can be tested
 * exhaustively without a database, per BOARD-PLAN.md Phase 2's "tests for
 * the matrix before building UI against it."
 */
export function can(subject: AuthzSubject, action: Action, resource: ResourceContext = {}): boolean {
  if (subject.companyStatus !== "ACTIVE") return false;
  if (!subject.companyRole) return false;

  // Hard rule: no one — not Owner, not Finance — can directly update
  // someone else's submission or note. The only path past this is an
  // Amendment (submission:amend / note:amend), which is a different,
  // always-attributed action.
  if (OWNERSHIP_RESTRICTED_ACTIONS.has(action)) {
    if (resource.ownerId !== undefined && resource.ownerId !== subject.userId) {
      return false;
    }
  }

  if (PROJECT_SCOPED_ACTIONS.has(action) && subject.companyRole !== "OWNER" && subject.companyRole !== "FINANCE") {
    // Owner and Finance act company-wide by design (billing/approval
    // oversight); Lead/Contributor/Adviser standing is per-project.
    if (!subject.projectRole) return false;
  }

  const roleCan = ROLE_ACTIONS[subject.companyRole].has(action);
  if (!roleCan) return false;

  if (COST_GATED_ACTIONS.has(action) && subject.companyRole !== "OWNER" && subject.companyRole !== "FINANCE") {
    return subject.canViewCosts;
  }

  return true;
}
