import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getCompanySummary } from "@/lib/compliance/summary";

function hoursLabel(minutes: number): string {
  return (minutes / 60).toFixed(0);
}

function moneyLabel(minorUnits: number): string {
  return `£${(minorUnits / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

/**
 * The persistent KPI strip beneath the nav (spec: "Sticky Summary
 * Header... fixed across navigation tabs"). Combines every company the
 * signed-in user belongs to — this is a personal workspace view, not a
 * per-company report (Finance already has that).
 */
export async function SummaryBanner() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) return null;

  const companyIds = [...new Set(currentUser.memberships.map((m) => m.companyId))];
  if (companyIds.length === 0) return null;

  const summaries = await Promise.all(companyIds.map((companyId) => getCompanySummary(prisma, companyId)));
  const totalMinutesYtd = summaries.reduce((sum, s) => sum + s.totalMinutesYtd, 0);
  const qualifyingExpenditureMinorUnits = summaries.reduce((sum, s) => sum + s.qualifyingExpenditureMinorUnits, 0);
  const weightedReadiness = summaries.reduce((sum, s) => sum + s.auditReadinessPct * s.totalMinutesYtd, 0);
  const auditReadinessPct = totalMinutesYtd > 0 ? Math.round(weightedReadiness / totalMinutesYtd) : 0;

  const currentYear = new Date().getFullYear();

  return (
    <div className="flex items-center gap-8 border-b border-black/[.055] bg-surface-header px-8 py-[10px]">
      <span className="flex items-baseline gap-[6px] text-[13px]">
        <span className="text-text-tertiary">Hours logged ({currentYear})</span>
        <span className="font-[590] text-text">{hoursLabel(totalMinutesYtd)}h</span>
      </span>
      <span className="flex items-baseline gap-[6px] text-[13px]">
        <span className="text-text-tertiary">Qualifying expenditure logged</span>
        <span className="font-[590] text-text">{moneyLabel(qualifyingExpenditureMinorUnits)}</span>
      </span>
      <span className="flex items-baseline gap-[6px] text-[13px]">
        <span className="text-text-tertiary">Audit readiness</span>
        <span className={`font-[590] ${auditReadinessPct >= 70 ? "text-accent" : auditReadinessPct >= 40 ? "text-[#C88A1E]" : "text-[#C0392B]"}`}>
          {auditReadinessPct}%
        </span>
      </span>
    </div>
  );
}
