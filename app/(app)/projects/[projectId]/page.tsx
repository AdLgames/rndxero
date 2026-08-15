import Link from "next/link";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize, canDo } from "@/lib/authz/service";
import { getIsoWeekKey, getWeekBoundaries, shiftWeekKey } from "@/lib/capture/week-key";
import { getOpenUncertainties, getPrefillMinutes } from "@/lib/capture/repository";
import { getCurrentPlanVersion, listPlanVersions } from "@/lib/plan/repository";
import { findApplicableRate } from "@/lib/cost/rate";
import { summarizeCostByPerson, summarizeCostByRole, type CostedRow } from "@/lib/plan/cost-summary";
import { getProjectClaimPack, type ClaimPackNoteEntry } from "@/lib/export/pack";
import { isNoteBacked } from "@/lib/compliance/readiness";
import { getAiProviderConfigSummary } from "@/lib/ai/repository";
import { PROJECT_SUGGESTED_QUERIES } from "@/lib/ai/suggested-queries";
import { badgeAccent, badgeNeutral, eyebrow } from "@/app/components/ui";
import { LockIcon } from "@/app/components/icons";
import { AiChatPanel } from "@/app/(app)/ai/AiChatPanel";
import { BackToProjects } from "../ProjectRail";
import { ProjectDescription } from "./ProjectDescription";
import { ProjectWeekLogCard, type WeekLogData } from "./ProjectWeekLogCard";
import { ProjectMembers, type ProjectMemberRow } from "./ProjectMembers";
import { ProjectGithubSection, type ProjectGithubData } from "./ProjectGithubSection";
import { CalendarPlanner, type CalendarAllocation, type CalendarActual } from "./CalendarPlanner";
import { ProjectCostSummary } from "./ProjectCostSummary";

/** Pre-fetched scroll band for the calendar planner: 4 weeks of history plus 20 forward — wide enough to genuinely scroll through, not just page through. */
const CALENDAR_WEEKS_BACK = 4;
const CALENDAR_WEEKS_FORWARD = 20;
/** Matches lib/locking's real auto-lock deadline (close + 7 days) — same constant capture/page.tsx uses. */
const AUTO_LOCK_DAYS_AFTER_CLOSE = 7;

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

  const [canViewPlan, canWritePlan, canViewCosts, canEditProject, canLogTime, canWriteCost, canManageRepos, canReviewSuggestions, canQueryAi] = await Promise.all([
    canDo(prisma, { userId: currentUser.id, companyId: project.companyId, projectId, action: "plan:read" }),
    canDo(prisma, { userId: currentUser.id, companyId: project.companyId, projectId, action: "plan:write" }),
    canDo(prisma, { userId: currentUser.id, companyId: project.companyId, projectId, action: "cost:read" }),
    canDo(prisma, { userId: currentUser.id, companyId: project.companyId, projectId, action: "project:update" }),
    canDo(prisma, { userId: currentUser.id, companyId: project.companyId, projectId, action: "submission:create" }),
    canDo(prisma, { userId: currentUser.id, companyId: project.companyId, projectId, action: "cost:write" }),
    canDo(prisma, { userId: currentUser.id, companyId: project.companyId, projectId, action: "project:update" }),
    canDo(prisma, { userId: currentUser.id, companyId: project.companyId, projectId, action: "note:create" }),
    canDo(prisma, { userId: currentUser.id, companyId: project.companyId, action: "ai:query" }),
  ]);
  const aiConfig = canQueryAi ? await getAiProviderConfigSummary(prisma, project.companyId) : null;

  const projectMembers = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const memberRows: ProjectMemberRow[] = projectMembers.map((m) => ({ id: m.id, userId: m.userId, name: m.user.name, role: m.role, costCategory: m.costCategory }));

  let githubData: ProjectGithubData | null = null;
  if (canManageRepos || canReviewSuggestions) {
    const [repoLinks, suggestions, openChallenges, headerList] = await Promise.all([
      canManageRepos ? prisma.githubRepoLink.findMany({ where: { projectId } }) : Promise.resolve([]),
      canReviewSuggestions ? prisma.suggestion.findMany({ where: { projectId, status: "PENDING" }, orderBy: { createdAt: "desc" } }) : Promise.resolve([]),
      prisma.uncertainty.findMany({ where: { projectId, outcome: "OPEN" }, select: { id: true, title: true } }),
      headers(),
    ]);
    const host = headerList.get("host") ?? "localhost:3000";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    githubData = {
      projectId,
      companyId: project.companyId,
      canManageRepos,
      canReviewSuggestions,
      repoLinks: repoLinks.map((r) => ({ id: r.id, repoFullName: r.repoFullName, webhookSecret: r.webhookSecret })),
      suggestions: suggestions.map((s) => ({ id: s.id, summary: s.summary, externalRef: s.externalRef })),
      challenges: openChallenges,
      webhookUrl: `${protocol}://${host}/api/github/webhook`,
      currentWeekKey: getIsoWeekKey(new Date()),
    };
  }

  const pack = await getProjectClaimPack(prisma, { projectId, includeCosts: canViewCosts });

  const currentWeekKey = getIsoWeekKey(new Date());
  const weekKeysWithActivity = new Set(pack.integrity.map((row) => row.weekKey));
  const lockedWeeks = pack.integrity.filter((row) => row.lockedAt !== null).length;
  const allNotes = pack.uncertainties.flatMap((u) => u.chronology.filter((e) => e.type !== "NO_PROGRESS"));
  const missingEvidenceCount = allNotes.filter((n) => !isNoteBacked(n)).length;

  // --- "Add time & notes" this week, scoped to this one project (mirrors capture/page.tsx) ---
  let weekLogData: WeekLogData | null = null;
  if (canLogTime) {
    const { start } = getWeekBoundaries(currentWeekKey);
    const previousWeekKey = getIsoWeekKey(new Date(start.getTime() - 24 * 60 * 60 * 1000));
    const daysUntilAutoLock = Math.floor(
      (getWeekBoundaries(currentWeekKey).end.getTime() + AUTO_LOCK_DAYS_AFTER_CLOSE * 86_400_000 - new Date().getTime()) / 86_400_000
    );
    const [openUncertainties, prefillMinutes, existingSubmission] = await Promise.all([
      getOpenUncertainties(prisma, projectId),
      getPrefillMinutes(prisma, { projectId, userId: currentUser.id, previousWeekKey }),
      prisma.weeklySubmission.findUnique({
        where: { projectId_userId_weekKey: { projectId, userId: currentUser.id, weekKey: currentWeekKey } },
      }),
    ]);
    weekLogData = {
      projectId,
      companyId: project.companyId,
      weekKey: currentWeekKey,
      daysUntilAutoLock,
      uncertainties: openUncertainties.map((u) => ({ id: u.id, title: u.title })),
      prefillMinutes,
      existing: existingSubmission
        ? { minutes: existingSubmission.minutes, basis: existingSubmission.basis, locked: existingSubmission.lockedAt !== null }
        : null,
    };
  }

  // --- Calendar planner: rows are people, not challenges (BOARD-PLAN's plan model already supports an
  // optional userId per allocation — this just pivots the same PlannedAllocation data by person instead
  // of by uncertainty, and reads plan-vs-actual per person/week instead of per challenge/week). ---
  let calendarProps: {
    weekKeys: string[];
    hasExistingPlan: boolean;
    allocations: CalendarAllocation[];
    actuals: CalendarActual[];
    versionHistory: Array<{ versionNumber: number; note: string | null; supersededAt: string | null; totalPlannedMinutes: number }>;
  } | null = null;
  let costSummary: { byPerson: ReturnType<typeof summarizeCostByPerson>; byRole: ReturnType<typeof summarizeCostByRole> } | null = null;
  if (canViewPlan) {
    const calendarWeekKeys = Array.from({ length: CALENDAR_WEEKS_BACK + CALENDAR_WEEKS_FORWARD + 1 }, (_, i) => shiftWeekKey(currentWeekKey, i - CALENDAR_WEEKS_BACK));
    const [currentPlan, allSubmissions, planVersions] = await Promise.all([
      getCurrentPlanVersion(prisma, projectId),
      prisma.weeklySubmission.findMany({ where: { projectId }, select: { userId: true, weekKey: true, minutes: true } }),
      listPlanVersions(prisma, projectId),
    ]);

    const allocations: CalendarAllocation[] = (currentPlan?.plannedAllocations ?? []).map((a) => ({
      userId: a.userId,
      uncertaintyId: a.uncertaintyId,
      weekKey: a.weekKey,
      plannedMinutes: a.plannedMinutes,
    }));
    const calendarWeekSet = new Set(calendarWeekKeys);
    const actuals: CalendarActual[] = allSubmissions.filter((s) => calendarWeekSet.has(s.weekKey)).map((s) => ({ userId: s.userId, weekKey: s.weekKey, minutes: s.minutes }));

    calendarProps = {
      weekKeys: calendarWeekKeys,
      hasExistingPlan: currentPlan !== null,
      allocations,
      actuals,
      versionHistory: planVersions.map((v) => ({
        versionNumber: v.versionNumber,
        note: v.note,
        supersededAt: v.supersededAt ? v.supersededAt.toISOString() : null,
        totalPlannedMinutes: v.plannedAllocations.reduce((sum, a) => sum + a.plannedMinutes, 0),
      })),
    };

    if (canViewCosts && memberRows.length > 0) {
      const rates = await prisma.rate.findMany({ where: { companyId: project.companyId, userId: { in: memberRows.map((m) => m.userId) } } });
      const rowsMap = new Map<string, { userId: string; weekKey: string; plannedMinutes: number; actualMinutes: number }>();
      for (const a of currentPlan?.plannedAllocations ?? []) {
        if (!a.userId) continue;
        const key = `${a.userId}:${a.weekKey}`;
        const existing = rowsMap.get(key) ?? { userId: a.userId, weekKey: a.weekKey, plannedMinutes: 0, actualMinutes: 0 };
        existing.plannedMinutes += a.plannedMinutes;
        rowsMap.set(key, existing);
      }
      for (const s of allSubmissions) {
        const key = `${s.userId}:${s.weekKey}`;
        const existing = rowsMap.get(key) ?? { userId: s.userId, weekKey: s.weekKey, plannedMinutes: 0, actualMinutes: 0 };
        existing.actualMinutes += s.minutes;
        rowsMap.set(key, existing);
      }
      const costedRows: CostedRow[] = [...rowsMap.values()].map((r) => {
        const { start } = getWeekBoundaries(r.weekKey);
        const rate = findApplicableRate(rates, r.userId, start);
        return {
          ...r,
          plannedCostMinorUnits: rate ? Math.round((r.plannedMinutes / 60) * rate.hourlyRateMinorUnits) : null,
          actualCostMinorUnits: rate ? Math.round((r.actualMinutes / 60) * rate.hourlyRateMinorUnits) : null,
        };
      });
      const byPerson = summarizeCostByPerson(memberRows.map((m) => ({ userId: m.userId, name: m.name, role: m.role })), costedRows);
      costSummary = { byPerson, byRole: summarizeCostByRole(byPerson) };
    }
  }

  const STAT_TILES = [
    { label: "Logged", value: hoursLabel(pack.totals.actualMinutes) },
    ...(canViewPlan ? [{ label: "Planned", value: hoursLabel(pack.totals.plannedMinutes) }] : []),
    ...(canViewCosts && pack.totals.derivedCostMinorUnits !== null ? [{ label: "Derived cost", value: moneyLabel(pack.totals.derivedCostMinorUnits) }] : []),
    { label: "Weeks locked", value: `${lockedWeeks} / ${weekKeysWithActivity.size}` },
  ];

  return (
    <div className="px-4 py-8 sm:px-8 sm:py-11 lg:px-12">
      <BackToProjects />
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
          <ProjectDescription projectId={projectId} companyId={project.companyId} description={project.description} canEdit={canEditProject} />
        </div>
        <div className="flex shrink-0 gap-2">
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

      {aiConfig && (
        <>
          <p className={`mt-9 mb-3 ${eyebrow}`}>Ask AI</p>
          <AiChatPanel companyId={project.companyId} projectId={projectId} suggestedQueries={PROJECT_SUGGESTED_QUERIES} />
        </>
      )}

      <p className={`mt-9 mb-3 ${eyebrow}`}>Owner &amp; contributors</p>
      <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken px-6 py-2">
        <ProjectMembers companyId={project.companyId} members={memberRows} canWriteCost={canWriteCost} />
      </div>

      {githubData && (
        <>
          <p className={`mt-9 mb-3 ${eyebrow}`}>GitHub</p>
          <ProjectGithubSection data={githubData} />
        </>
      )}

      {weekLogData && (
        <>
          <p className={`mt-9 mb-3 ${eyebrow}`}>Add time &amp; notes</p>
          <ProjectWeekLogCard data={weekLogData} />
        </>
      )}

      {calendarProps && (
        <>
          <p className={`mt-9 mb-3 ${eyebrow}`}>Planner</p>
          <CalendarPlanner
            companyId={project.companyId}
            projectId={projectId}
            canWrite={canWritePlan}
            members={memberRows.map((m) => ({ userId: m.userId, name: m.name, role: m.role }))}
            challenges={pack.uncertainties.map((u) => ({ id: u.id, title: u.title }))}
            weekKeys={calendarProps.weekKeys}
            currentWeekKey={currentWeekKey}
            hasExistingPlan={calendarProps.hasExistingPlan}
            allocations={calendarProps.allocations}
            actuals={calendarProps.actuals}
            versionHistory={calendarProps.versionHistory}
          />
        </>
      )}

      {costSummary && (
        <>
          <p className={`mt-9 mb-3 ${eyebrow}`}>Cost by person &amp; role</p>
          <ProjectCostSummary byPerson={costSummary.byPerson} byRole={costSummary.byRole} />
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
                <p className="m-0 text-[13px] text-text-quaternary">No entries logged against this challenge yet.</p>
              ) : (
                u.chronology.map((entry, i) => <NoteEntry key={i} entry={entry} />)
              )}
            </div>
          </div>
        ))}
        {pack.uncertainties.length === 0 && <p className="text-[14px] text-text-secondary">No challenges recorded for this project yet.</p>}
      </div>
    </div>
  );
}
