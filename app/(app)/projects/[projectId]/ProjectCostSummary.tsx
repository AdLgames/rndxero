import type { PersonCostSummary, RoleCostSummary } from "@/lib/plan/cost-summary";

const ROLE_LABEL: Record<string, string> = { LEAD: "Owner", CONTRIBUTOR: "Contributor", ADVISER: "Adviser" };

function hoursLabel(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function moneyLabel(minorUnits: number | null): string {
  return minorUnits === null ? "—" : `£${(minorUnits / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

/** Cost:read only — derived from planned/actual minutes × the Rate covering each week, same lookup lib/plan/repository.ts already uses for the single project-total figure, just broken out per person and per role. */
export function ProjectCostSummary({ byPerson, byRole }: { byPerson: PersonCostSummary[]; byRole: RoleCostSummary[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-5">
        <p className="m-0 mb-3 text-[12.5px] font-[590] text-text-tertiary">By person</p>
        <div className="flex flex-col divide-y divide-black/[.055]">
          {byPerson.map((p) => (
            <div key={p.userId} className="flex items-center justify-between gap-3 py-[9px] text-[13px]">
              <span className="truncate text-text">{p.name}</span>
              <span className="shrink-0 text-text-tertiary">
                {hoursLabel(p.plannedMinutes)} planned · {hoursLabel(p.actualMinutes)} logged
              </span>
              <span className="shrink-0 font-[590] text-text">{moneyLabel(p.actualCostMinorUnits)}</span>
            </div>
          ))}
          {byPerson.length === 0 && <p className="py-2 text-[13px] text-text-quaternary">No one costed yet.</p>}
        </div>
      </div>

      <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-5">
        <p className="m-0 mb-3 text-[12.5px] font-[590] text-text-tertiary">By role</p>
        <div className="flex flex-col divide-y divide-black/[.055]">
          {byRole.map((r) => (
            <div key={r.role} className="flex items-center justify-between gap-3 py-[9px] text-[13px]">
              <span className="text-text">{ROLE_LABEL[r.role] ?? r.role}</span>
              <span className="shrink-0 text-text-tertiary">
                {hoursLabel(r.plannedMinutes)} planned · {hoursLabel(r.actualMinutes)} logged
              </span>
              <span className="shrink-0 font-[590] text-text">{moneyLabel(r.actualCostMinorUnits)}</span>
            </div>
          ))}
          {byRole.length === 0 && <p className="py-2 text-[13px] text-text-quaternary">No one costed yet.</p>}
        </div>
      </div>
    </div>
  );
}
