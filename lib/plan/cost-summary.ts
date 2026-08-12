import type { ProjectRole } from "@/lib/generated/prisma/client";

/**
 * Aggregates already-costed per-person-per-week rows into per-person and
 * per-role totals for the calendar planner's cost section. Deliberately
 * takes pre-resolved minor-units figures rather than raw Rate rows plus a
 * date — the messy "which rate applied on this specific week" lookup
 * (lib/cost/rate.ts's findApplicableRate) stays where the rest of the app
 * already does it, at the DB-adjacent call site, so this stays pure
 * arithmetic and easy to test in isolation.
 */

export interface CostedRow {
  userId: string;
  weekKey: string;
  plannedMinutes: number;
  actualMinutes: number;
  /** Null when no Rate covered this person for this week — cost is unknown, not zero. */
  plannedCostMinorUnits: number | null;
  actualCostMinorUnits: number | null;
}

export interface PersonCostSummary {
  userId: string;
  name: string;
  role: ProjectRole;
  plannedMinutes: number;
  actualMinutes: number;
  plannedCostMinorUnits: number | null;
  actualCostMinorUnits: number | null;
}

export interface RoleCostSummary {
  role: ProjectRole;
  plannedMinutes: number;
  actualMinutes: number;
  plannedCostMinorUnits: number | null;
  actualCostMinorUnits: number | null;
}

function sumCost(a: number | null, b: number | null): number | null {
  if (a === null && b === null) return null;
  return (a ?? 0) + (b ?? 0);
}

export function summarizeCostByPerson(
  members: Array<{ userId: string; name: string; role: ProjectRole }>,
  rows: CostedRow[]
): PersonCostSummary[] {
  return members.map((member) => {
    const memberRows = rows.filter((r) => r.userId === member.userId);
    return memberRows.reduce<PersonCostSummary>(
      (acc, row) => ({
        ...acc,
        plannedMinutes: acc.plannedMinutes + row.plannedMinutes,
        actualMinutes: acc.actualMinutes + row.actualMinutes,
        plannedCostMinorUnits: sumCost(acc.plannedCostMinorUnits, row.plannedCostMinorUnits),
        actualCostMinorUnits: sumCost(acc.actualCostMinorUnits, row.actualCostMinorUnits),
      }),
      { userId: member.userId, name: member.name, role: member.role, plannedMinutes: 0, actualMinutes: 0, plannedCostMinorUnits: null, actualCostMinorUnits: null }
    );
  });
}

export function summarizeCostByRole(personSummaries: PersonCostSummary[]): RoleCostSummary[] {
  const byRole = new Map<ProjectRole, RoleCostSummary>();
  for (const person of personSummaries) {
    const existing = byRole.get(person.role) ?? {
      role: person.role,
      plannedMinutes: 0,
      actualMinutes: 0,
      plannedCostMinorUnits: null,
      actualCostMinorUnits: null,
    };
    byRole.set(person.role, {
      role: person.role,
      plannedMinutes: existing.plannedMinutes + person.plannedMinutes,
      actualMinutes: existing.actualMinutes + person.actualMinutes,
      plannedCostMinorUnits: sumCost(existing.plannedCostMinorUnits, person.plannedCostMinorUnits),
      actualCostMinorUnits: sumCost(existing.actualCostMinorUnits, person.actualCostMinorUnits),
    });
  }
  return [...byRole.values()];
}
