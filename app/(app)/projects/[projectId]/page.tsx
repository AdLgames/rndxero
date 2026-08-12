import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize, canDo } from "@/lib/authz/service";
import { getIsoWeekKey, shiftWeekKey } from "@/lib/capture/week-key";
import { getProjectClaimPack, type ClaimPackNoteEntry, type ClaimPackUncertainty } from "@/lib/export/pack";
import { isNoteBacked } from "@/lib/compliance/readiness";
import { badgeAccent, badgeNeutral, eyebrow } from "@/app/components/ui";
import { LockIcon } from "@/app/components/icons";

const GANTT_WEEK_COUNT = 16;

const TYPE_LABEL: Record<ClaimPackNoteEntry["type"], string> = {
  NO_PROGRESS: "No progress",
  ATTEMPT: "Tried something",
  BLOCKER: "Blocker",
  FAILED_ATTEMPT: "Hit a wall",
  RESOLUTION: "Solved it",
};

function hoursLabel(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

function moneyLabel(minorUnits: number): string {
  return `£${(minorUnits / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function isLikelyUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** 24h fills the 40px plot; anything above clamps to full height rather than overflowing — a shorter cap than Board's since this is a per-uncertainty (not per-project) weekly figure. */
function barHeight(minutes: number): number {
  const hours = Math.min(minutes / 60, 24);
  return Math.round((hours / 24) * 40);
}

/**
 * A lightweight Gantt-style read: one lane per uncertainty, one column per
 * week, a pale planned bar behind a solid actual bar — the same visual
 * grammar as the Board (BoardClient.tsx), just re-scoped from "lanes are
 * projects" to "lanes are uncertainties within one project" so plan vs
 * actual is visible per line of inquiry, not just per project total.
 * Read-only: no click-to-expand popover here, unlike Board's WeekColumn —
 * the narratives below already give the full chronology.
 */
function GanttChart({
  uncertainties,
  variance,
  weekKeys,
  currentWeekKey,
}: {
  uncertainties: ClaimPackUncertainty[];
  variance: Array<{ uncertaintyTitle: string; weekKey: string; plannedMinutes: number; actualMinutes: number }>;
  weekKeys: string[];
  currentWeekKey: string;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-[16px] border border-black/[.06] p-5">
      <div className="flex items-center gap-[22px] text-[12px] text-text-tertiary">
        <span className="flex items-center gap-[6px]">
          <span className="h-3 w-3 rounded-[6px] bg-track" /> Planned
        </span>
        <span className="flex items-center gap-[6px]">
          <span className="h-3 w-3 rounded-[6px] bg-accent" /> Logged
        </span>
      </div>

      {uncertainties.map((u) => {
        const rows = variance.filter((v) => v.uncertaintyTitle === u.title);
        const byWeek = new Map(rows.map((r) => [r.weekKey, r]));

        return (
          <div key={u.id}>
            {/* Title sits outside the horizontal-scroll region below — sharing one scroll
                container with the bars would put the title's containing block at the
                bars' full width, so at the default (leftmost) scroll position a title
                longer than the viewport gets cut off mid-word instead of wrapping. */}
            <p className="m-0 mb-2 text-[13.5px] font-[600] tracking-[-0.01em] text-text">{u.title}</p>
            <div className="overflow-x-auto">
              <div className="flex w-max items-end gap-[6px]">
                {weekKeys.map((weekKey) => {
                  const row = byWeek.get(weekKey);
                  const planned = row?.plannedMinutes ?? 0;
                  const actual = row?.actualMinutes ?? 0;
                  const isCurrentWeek = weekKey === currentWeekKey;
                  return (
                    <div
                      key={weekKey}
                      className={`relative flex h-[54px] w-[26px] shrink-0 flex-col items-center justify-end gap-[3px] ${
                        isCurrentWeek ? "rounded-[8px] bg-accent-wash" : ""
                      }`}
                      title={`${weekKey}: ${hoursLabel(planned)} planned, ${hoursLabel(actual)} logged`}
                    >
                      <span className="relative h-[40px] w-full">
                        <span className="absolute bottom-0 left-1/2 w-[12px] -translate-x-1/2 rounded-[6px] bg-track" style={{ height: barHeight(planned) }} />
                        <span className="absolute bottom-0 left-1/2 w-[12px] -translate-x-1/2 rounded-[6px] bg-accent" style={{ height: barHeight(actual) }} />
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex w-max items-end gap-[6px]">
                {weekKeys.map((weekKey) => (
                  <span key={weekKey} className={`w-[26px] shrink-0 text-center text-[10.5px] ${weekKey === currentWeekKey ? "font-[590] text-accent" : "text-text-quaternary"}`}>
                    {weekKey.slice(6)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NoteEntry({ entry }: { entry: ClaimPackNoteEntry }) {
  const backed = entry.type === "NO_PROGRESS" || isNoteBacked(entry);
  return (
    <div className="rounded-[12px] border border-black/[.055] p-[14px]">
      <div className="flex flex-wrap items-center gap-[8px]">
        <span className="text-[11.5px] font-[590] text-text-tertiary">{TYPE_LABEL[entry.type]}</span>
        <span className="text-[11.5px] text-text-quaternary">· {entry.weekKey}</span>
        {entry.minutes !== null && <span className="text-[11.5px] text-text-quaternary">· {hoursLabel(entry.minutes)}</span>}
        {entry.locked && (
          <span className={`${badgeNeutral} gap-[4px]`}>
            <LockIcon className="h-[9px] w-[9px]" /> locked
          </span>
        )}
        {entry.isRetrospective && <span className={badgeNeutral}>retrospective</span>}
        {!backed && <span className="rounded-full bg-[#FDF3E7] px-[9px] py-[3px] text-[11px] font-[590] text-[#8A5A15]">missing evidence</span>}
      </div>
      <p className="m-0 mt-2 text-[13.5px] leading-[1.5] text-text">{entry.body}</p>
      {entry.evidenceRef && (
        <p className="m-0 mt-1 text-[12.5px] text-text-tertiary">
          Evidence:{" "}
          {isLikelyUrl(entry.evidenceRef) ? (
            <a href={entry.evidenceRef} target="_blank" rel="noopener noreferrer" className="break-all font-[500]">
              {entry.evidenceRef}
            </a>
          ) : (
            <span className="break-all text-text-secondary">{entry.evidenceRef}</span>
          )}
        </p>
      )}
      {entry.amendments.length > 0 && (
        <div className="mt-2 flex flex-col gap-1 border-t border-black/[.055] pt-2">
          {entry.amendments.map((a, i) => (
            <p key={i} className="m-0 text-[12.5px] leading-[1.5] text-text-secondary">
              <span className={badgeAccent}>Amendment</span> {a.body} — {a.authorName}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();

  try {
    await authorize(prisma, { userId: currentUser.id, companyId: project.companyId, projectId, action: "note:read" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return (
        <div className="px-4 py-8 sm:px-8 sm:py-11 lg:px-12">
          <p className="text-[15px] text-text-secondary">You don&apos;t have access to this project.</p>
        </div>
      );
    }
    throw error;
  }

  const [canViewPlan, canViewCosts] = await Promise.all([
    canDo(prisma, { userId: currentUser.id, companyId: project.companyId, projectId, action: "plan:read" }),
    canDo(prisma, { userId: currentUser.id, companyId: project.companyId, projectId, action: "cost:read" }),
  ]);

  const pack = await getProjectClaimPack(prisma, { projectId, includeCosts: canViewCosts });

  const currentWeekKey = getIsoWeekKey(new Date());
  const weekKeys = Array.from({ length: GANTT_WEEK_COUNT }, (_, i) => shiftWeekKey(currentWeekKey, i - (GANTT_WEEK_COUNT - 1)));

  const weekKeysWithActivity = new Set(pack.integrity.map((row) => row.weekKey));
  const lockedWeeks = pack.integrity.filter((row) => row.lockedAt !== null).length;
  const allNotes = pack.uncertainties.flatMap((u) => u.chronology.filter((e) => e.type !== "NO_PROGRESS"));
  const missingEvidenceCount = allNotes.filter((n) => !isNoteBacked(n)).length;

  const STAT_TILES = [
    { label: "Logged", value: hoursLabel(pack.totals.actualMinutes) },
    ...(canViewPlan ? [{ label: "Planned", value: hoursLabel(pack.totals.plannedMinutes) }] : []),
    ...(canViewCosts && pack.totals.derivedCostMinorUnits !== null ? [{ label: "Derived cost", value: moneyLabel(pack.totals.derivedCostMinorUnits) }] : []),
    { label: "Weeks locked", value: `${lockedWeeks} / ${weekKeysWithActivity.size}` },
  ];

  return (
    <div className="px-4 py-8 sm:px-8 sm:py-11 lg:px-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-[10px]">
            <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">{project.name}</h2>
            <span className={project.status === "ACTIVE" ? badgeAccent : badgeNeutral}>{project.status === "ACTIVE" ? "Active" : project.status === "COMPLETED" ? "Completed" : "Abandoned"}</span>
          </div>
          <p className="m-0 mt-[7px] max-w-[62ch] text-[15px] leading-[1.5] text-text-secondary">
            Started {new Date(project.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            {pack.project.competentProfessionals.length > 0 ? ` · ${pack.project.competentProfessionals.join(", ")}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href={`/planner/${projectId}`} className="rounded-[10px] border border-black/[.11] bg-white px-[15px] py-[9px] text-[13px] font-[590] text-text transition-colors duration-150 hover:bg-[#FAFAFA]">
            Planner
          </Link>
          <Link href={`/export/${projectId}`} className="rounded-[10px] border border-black/[.11] bg-white px-[15px] py-[9px] text-[13px] font-[590] text-text transition-colors duration-150 hover:bg-[#FAFAFA]">
            Export
          </Link>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAT_TILES.map((tile) => (
          <div key={tile.label} className="rounded-[14px] border border-black/[.06] bg-surface-sunken px-5 py-4">
            <p className={eyebrow}>{tile.label}</p>
            <p className="m-0 mt-1 text-[22px] font-[640] tracking-[-0.02em] text-text">{tile.value}</p>
          </div>
        ))}
      </div>

      {missingEvidenceCount > 0 && (
        <div className="mt-6 rounded-[10px] border border-[#E8C77A] bg-[#FDF6E7] px-4 py-3 text-[13px] leading-[1.5] text-[#7A5A12]">
          {missingEvidenceCount} note{missingEvidenceCount === 1 ? "" : "s"} on this project {missingEvidenceCount === 1 ? "is" : "are"} missing a narrative
          or a linked piece of evidence.
        </div>
      )}

      {canViewPlan && pack.uncertainties.length > 0 && (
        <>
          <p className={`mt-9 mb-3 ${eyebrow}`}>Plan vs actual — last {GANTT_WEEK_COUNT} weeks</p>
          <GanttChart uncertainties={pack.uncertainties} variance={pack.variance} weekKeys={weekKeys} currentWeekKey={currentWeekKey} />
        </>
      )}

      <p className={`mt-9 mb-3 ${eyebrow}`}>Evidence &amp; narratives</p>
      <div className="flex flex-col gap-5">
        {pack.uncertainties.map((u) => (
          <div key={u.id} className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-6">
            <div className="flex flex-wrap items-center gap-[10px]">
              <h4 className="m-0 text-[16.5px] font-[600] tracking-[-0.02em] text-text">{u.title}</h4>
              <span className={u.outcome === "RESOLVED" ? badgeAccent : badgeNeutral}>{u.outcome === "RESOLVED" ? "Resolved" : u.outcome === "ABANDONED" ? "Abandoned" : "Open"}</span>
              <span className="text-[12.5px] text-text-quaternary">{hoursLabel(u.totalMinutes)} attributed</span>
            </div>
            <p className="m-0 mt-2 text-[13.5px] leading-[1.5] text-text-secondary">
              <span className="text-text-tertiary">Baseline — </span>
              {u.baseline}
            </p>

            <div className="mt-4 flex flex-col gap-2 border-t border-black/[.055] pt-4">
              {u.chronology.length === 0 ? (
                <p className="m-0 text-[13px] text-text-quaternary">No entries logged against this uncertainty yet.</p>
              ) : (
                u.chronology.map((entry, i) => <NoteEntry key={i} entry={entry} />)
              )}
            </div>
          </div>
        ))}
        {pack.uncertainties.length === 0 && <p className="text-[14px] text-text-secondary">No uncertainties recorded for this project yet.</p>}
      </div>
    </div>
  );
}
