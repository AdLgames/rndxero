import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UncertaintyNoteType } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canDo, listAccessibleProjectIds } from "@/lib/authz/service";
import { getIsoWeekKey, getWeekBoundaries, shiftWeekKey } from "@/lib/capture/week-key";
import { isNoteBacked } from "@/lib/compliance/readiness";
import { buildNextActions, type NextAction, type UnloggedProject } from "@/lib/dashboard/tasks";
import { ArrowRightIcon } from "@/app/components/icons";
import { eyebrow } from "@/app/components/ui";
import { NAV_GROUPS } from "@/app/components/nav-groups";

/** Matches lib/locking's real auto-lock deadline (close + 7 days) — same constant capture/page.tsx uses. */
const AUTO_LOCK_DAYS_AFTER_CLOSE = 7;
const TOP_PROJECT_COUNT = 5;
const BOARD_WEEK_COUNT = 8;
const RECENT_ACTIVITY_COUNT = 8;

/** Same colour-scale grammar as the pre-login marketing page's board illustration and BoardClient.tsx's real board — opacity ramps with how hard-won the week's evidence was, not a second hue. */
const TYPE_PRIORITY: UncertaintyNoteType[] = ["FAILED_ATTEMPT", "BLOCKER", "RESOLUTION", "ATTEMPT", "NO_PROGRESS"];
const CELL_STYLE: Record<UncertaintyNoteType, string> = {
  NO_PROGRESS: "border border-dashed border-black/[.12]",
  ATTEMPT: "bg-accent/40",
  BLOCKER: "bg-accent/60",
  FAILED_ATTEMPT: "bg-accent/80",
  RESOLUTION: "bg-accent",
};
const EMPTY_CELL_STYLE = "border border-dashed border-black/[.12]";

const NOTE_TYPE_LABEL: Record<UncertaintyNoteType, string> = {
  NO_PROGRESS: "no progress",
  ATTEMPT: "tried something",
  BLOCKER: "hit a blocker",
  FAILED_ATTEMPT: "hit a wall",
  RESOLUTION: "solved it",
};

function dominantType(types: UncertaintyNoteType[]): UncertaintyNoteType | null {
  for (const t of TYPE_PRIORITY) {
    if (types.includes(t)) return t;
  }
  return null;
}

function fmtHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? hours.toString() : hours.toFixed(1);
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const currentWeekKey = getIsoWeekKey(new Date());
  const currentYear = String(new Date().getFullYear());
  const { end } = getWeekBoundaries(currentWeekKey);
  const daysUntilAutoLock = Math.floor((end.getTime() + AUTO_LOCK_DAYS_AFTER_CLOSE * 86_400_000 - new Date().getTime()) / 86_400_000);

  const companyIds = [...new Set(currentUser.memberships.map((m) => m.companyId))];
  const financeCompanyIds = currentUser.memberships
    .filter((m) => m.role === "OWNER" || m.role === "FINANCE")
    .map((m) => m.companyId);

  const perCompany = await Promise.all(
    companyIds.map(async (companyId) => {
      const accessibleProjectIds = await listAccessibleProjectIds(prisma, { userId: currentUser.id, companyId });
      const [activeProjects, allProjectsCount] = await Promise.all([
        prisma.project.findMany({
          where: { id: { in: accessibleProjectIds }, status: "ACTIVE" },
          select: { id: true, name: true },
        }),
        prisma.project.count({ where: { id: { in: accessibleProjectIds } } }),
      ]);

      const existingSubmissionsThisWeek = activeProjects.length
        ? await prisma.weeklySubmission.findMany({
            where: { userId: currentUser.id, projectId: { in: activeProjects.map((p) => p.id) }, weekKey: currentWeekKey },
            select: { projectId: true },
          })
        : [];
      const loggedProjectIds = new Set(existingSubmissionsThisWeek.map((s) => s.projectId));
      const unloggedProjects: UnloggedProject[] = activeProjects
        .filter((p) => !loggedProjectIds.has(p.id))
        .map((p) => ({ projectId: p.id, projectName: p.name }));

      const reviewChecks = await Promise.all(
        activeProjects.map(async (p) => ({
          projectId: p.id,
          canReview: await canDo(prisma, { userId: currentUser.id, companyId, projectId: p.id, action: "note:create" }),
        }))
      );
      const reviewableProjectIds = reviewChecks.filter((c) => c.canReview).map((c) => c.projectId);
      const pendingSuggestionCount = reviewableProjectIds.length
        ? await prisma.suggestion.count({ where: { projectId: { in: reviewableProjectIds }, status: "PENDING" } })
        : 0;

      return { activeProjectsCount: activeProjects.length, allProjectsCount, unloggedProjects, pendingSuggestionCount };
    })
  );

  const activeProjectsCount = perCompany.reduce((sum, c) => sum + c.activeProjectsCount, 0);
  const allProjectsCount = perCompany.reduce((sum, c) => sum + c.allProjectsCount, 0);
  const unloggedProjects = perCompany.flatMap((c) => c.unloggedProjects);
  const pendingSuggestionCount = perCompany.reduce((sum, c) => sum + c.pendingSuggestionCount, 0);

  const [thisWeek, yearToDate, thisYearNotes, unlockedSubmissionCount] = await Promise.all([
    prisma.weeklySubmission.aggregate({ where: { userId: currentUser.id, weekKey: currentWeekKey }, _sum: { minutes: true } }),
    prisma.weeklySubmission.aggregate({ where: { userId: currentUser.id, weekKey: { startsWith: currentYear } }, _sum: { minutes: true } }),
    prisma.uncertaintyNote.findMany({
      where: { type: { not: "NO_PROGRESS" }, submission: { userId: currentUser.id, weekKey: { startsWith: currentYear } } },
      select: { body: true, evidenceRef: true },
    }),
    financeCompanyIds.length
      ? prisma.weeklySubmission.count({ where: { companyId: { in: financeCompanyIds }, lockedAt: null, weekKey: { lt: currentWeekKey } } })
      : 0,
  ]);

  const amberNoteCount = thisYearNotes.filter((n) => !isNoteBacked(n)).length;

  const nextActions = buildNextActions({
    weekKey: currentWeekKey,
    daysUntilAutoLock,
    unloggedProjects,
    amberNoteCount,
    unlockedSubmissionCount,
    pendingSuggestionCount,
  });

  // --- Top projects (board-style graphic) + latest activity, across every accessible project ---
  const allAccessibleProjectIds = [
    ...new Set((await Promise.all(companyIds.map((companyId) => listAccessibleProjectIds(prisma, { userId: currentUser.id, companyId })))).flat()),
  ];

  const boardWeekKeys = Array.from({ length: BOARD_WEEK_COUNT }, (_, i) => shiftWeekKey(currentWeekKey, i - (BOARD_WEEK_COUNT - 1)));

  let topProjects: Array<{ id: string; name: string; cellsByWeek: Record<string, UncertaintyNoteType | null> }> = [];
  let recentActivity: Array<{ id: string; projectId: string; projectName: string; userName: string; type: UncertaintyNoteType; body: string; weekKey: string }> = [];

  if (allAccessibleProjectIds.length > 0) {
    const [recentByActivity, recentlyCreated] = await Promise.all([
      prisma.weeklySubmission.groupBy({
        by: ["projectId"],
        where: { projectId: { in: allAccessibleProjectIds } },
        _max: { submittedAt: true },
        orderBy: { _max: { submittedAt: "desc" } },
        take: TOP_PROJECT_COUNT,
      }),
      prisma.project.findMany({
        where: { id: { in: allAccessibleProjectIds } },
        orderBy: { createdAt: "desc" },
        take: TOP_PROJECT_COUNT,
        select: { id: true },
      }),
    ]);
    const topProjectIds = [...new Set([...recentByActivity.map((r) => r.projectId), ...recentlyCreated.map((p) => p.id)])].slice(0, TOP_PROJECT_COUNT);

    if (topProjectIds.length > 0) {
      const [projects, submissions] = await Promise.all([
        prisma.project.findMany({ where: { id: { in: topProjectIds } }, select: { id: true, name: true } }),
        prisma.weeklySubmission.findMany({
          where: { projectId: { in: topProjectIds }, weekKey: { in: boardWeekKeys } },
          select: { projectId: true, weekKey: true, notes: { select: { type: true } } },
        }),
      ]);
      const projectNameById = new Map(projects.map((p) => [p.id, p.name]));
      topProjects = topProjectIds
        .filter((id) => projectNameById.has(id))
        .map((id) => {
          const cellsByWeek: Record<string, UncertaintyNoteType | null> = {};
          for (const wk of boardWeekKeys) {
            const types = submissions.filter((s) => s.projectId === id && s.weekKey === wk).flatMap((s) => s.notes.map((n) => n.type));
            cellsByWeek[wk] = dominantType(types);
          }
          return { id, name: projectNameById.get(id)!, cellsByWeek };
        });
    }

    const recentNotes = await prisma.uncertaintyNote.findMany({
      where: { type: { not: "NO_PROGRESS" }, submission: { projectId: { in: allAccessibleProjectIds } } },
      orderBy: { createdAt: "desc" },
      take: RECENT_ACTIVITY_COUNT,
      select: {
        id: true,
        type: true,
        body: true,
        submission: { select: { weekKey: true, project: { select: { id: true, name: true } }, user: { select: { name: true } } } },
      },
    });
    recentActivity = recentNotes.map((n) => ({
      id: n.id,
      projectId: n.submission.project.id,
      projectName: n.submission.project.name,
      userName: n.submission.user.name,
      type: n.type,
      body: n.body,
      weekKey: n.submission.weekKey,
    }));
  }

  const firstName = currentUser.name.trim().split(/\s+/)[0];

  const STAT_TILES = [
    {
      label: "Active projects",
      value: activeProjectsCount.toString(),
      caption: allProjectsCount !== activeProjectsCount ? `${allProjectsCount} total` : "across every company",
    },
    { label: "Your hours — this week", value: `${fmtHours(thisWeek._sum.minutes ?? 0)}h`, caption: currentWeekKey },
    { label: "Your hours — this year", value: `${fmtHours(yearToDate._sum.minutes ?? 0)}h`, caption: currentYear },
  ];

  return (
    <div className="px-4 py-8 sm:px-8 sm:py-11 lg:px-12">
      <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">Welcome back, {firstName}</h2>
      <p className="m-0 mt-[7px] max-w-[58ch] text-[15px] leading-[1.5] text-text-secondary">
        Where things stand across every company you belong to, and what&apos;s worth doing next.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STAT_TILES.map((tile) => (
          <div key={tile.label} className="rounded-[16px] border border-black/[.06] bg-surface-sunken px-6 py-5">
            <p className={eyebrow}>{tile.label}</p>
            <p className="m-0 mt-1 text-[32px] font-[640] tracking-[-0.03em] text-text">{tile.value}</p>
            <p className="m-0 mt-[2px] text-[12.5px] text-text-quaternary">{tile.caption}</p>
          </div>
        ))}
      </div>

      <p className={`mt-10 mb-3 ${eyebrow}`}>What to do next</p>
      {nextActions.length === 0 ? (
        <div className="rounded-[16px] border border-black/[.06] bg-accent-wash px-6 py-5">
          <p className="m-0 text-[14.5px] font-[590] text-accent">You&apos;re all caught up — nothing needs your attention right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-[10px]">
          {nextActions.map((action) => (
            <NextActionCard key={action.kind} action={action} />
          ))}
        </div>
      )}

      {topProjects.length > 0 && (
        <>
          <p className={`mt-10 mb-3 ${eyebrow}`}>Top projects</p>
          <TopProjectsBoard projects={topProjects} weekKeys={boardWeekKeys} />
        </>
      )}

      {recentActivity.length > 0 && (
        <>
          <p className={`mt-10 mb-3 ${eyebrow}`}>Latest activity</p>
          <div className="flex flex-col gap-[10px]">
            {recentActivity.map((entry) => (
              <Link
                key={entry.id}
                href={`/projects/${entry.projectId}`}
                className="flex items-start gap-3 rounded-[14px] border border-black/[.06] bg-surface-sunken px-5 py-4 transition-colors duration-150 hover:bg-surface-header"
              >
                <span className={`mt-[3px] h-[9px] w-[9px] shrink-0 rounded-[3px] ${CELL_STYLE[entry.type]}`} />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[13.5px] text-text">
                    <span className="font-[590]">{entry.userName}</span> {NOTE_TYPE_LABEL[entry.type]} on <span className="font-[590]">{entry.projectName}</span>
                  </p>
                  <p className="m-0 mt-[3px] truncate text-[12.5px] text-text-tertiary">{entry.body}</p>
                </div>
                <span className="shrink-0 text-[11.5px] text-text-quaternary">{entry.weekKey}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className={`mt-10 mb-3 ${eyebrow}`}>Jump to a workspace</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {NAV_GROUPS.map((group) => (
          <Link
            key={group.label}
            href={group.href}
            className="flex items-center justify-between rounded-[14px] border border-black/[.06] bg-surface-sunken px-5 py-4 text-[14.5px] font-[600] tracking-[-0.01em] text-text transition-colors duration-150 hover:bg-surface-header"
          >
            {group.label}
            <ArrowRightIcon className="shrink-0 text-text-quaternary" />
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * The same schematic-board visual language as the pre-login marketing
 * homepage's illustration (app/page.tsx's BoardIllustration — one lane
 * per project, one cell per week, opacity ramping with how hard the
 * week's evidence was won) — except every cell here is real, computed
 * from this person's actual accessible projects rather than a fixed
 * decorative mock.
 */
function TopProjectsBoard({
  projects,
  weekKeys,
}: {
  projects: Array<{ id: string; name: string; cellsByWeek: Record<string, UncertaintyNoteType | null> }>;
  weekKeys: string[];
}) {
  return (
    <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-5">
      <div className="flex flex-col gap-3">
        {projects.map((project) => (
          <Link key={project.id} href={`/projects/${project.id}`} className="flex items-center gap-3 rounded-[10px] p-2 transition-colors duration-150 hover:bg-white">
            <span className="w-32 shrink-0 truncate text-[12.5px] font-[500] text-text-secondary sm:w-40">{project.name}</span>
            <span className="flex gap-1">
              {weekKeys.map((wk) => {
                const type = project.cellsByWeek[wk];
                return <span key={wk} className={`h-4 w-4 shrink-0 rounded-[4px] ${type ? CELL_STYLE[type] : EMPTY_CELL_STYLE}`} title={`${wk}${type ? `: ${NOTE_TYPE_LABEL[type]}` : ""}`} />;
              })}
            </span>
          </Link>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-[14px] border-t border-black/[.055] pt-3 text-[11px] text-text-tertiary">
        <span className="flex items-center gap-[6px]">
          <span className={`h-3 w-3 rounded-[4px] ${EMPTY_CELL_STYLE}`} /> No progress
        </span>
        <span className="flex items-center gap-[6px]">
          <span className="h-3 w-3 rounded-[4px] bg-accent/40" /> Tried something
        </span>
        <span className="flex items-center gap-[6px]">
          <span className="h-3 w-3 rounded-[4px] bg-accent/60" /> Blocker
        </span>
        <span className="flex items-center gap-[6px]">
          <span className="h-3 w-3 rounded-[4px] bg-accent/80" /> Hit a wall
        </span>
        <span className="flex items-center gap-[6px]">
          <span className="h-3 w-3 rounded-[4px] bg-accent" /> Solved it
        </span>
      </div>
    </div>
  );
}

function NextActionCard({ action }: { action: NextAction }) {
  return (
    <Link
      href={action.href}
      className="flex items-center justify-between gap-4 rounded-[14px] border border-black/[.06] bg-surface-sunken px-[22px] py-[18px] transition-colors duration-150 hover:bg-surface-header"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-[10px]">
          <span className="flex h-[22px] min-w-[22px] shrink-0 items-center justify-center rounded-full bg-accent px-[6px] text-[11.5px] font-[640] text-white">
            {action.count}
          </span>
          <h4 className="m-0 text-[15px] font-[600] tracking-[-0.02em] text-text">{action.title}</h4>
        </div>
        <p className="m-0 mt-1 text-[13.5px] leading-[1.5] text-text-secondary">{action.description}</p>
      </div>
      <ArrowRightIcon className="shrink-0 text-text-quaternary" />
    </Link>
  );
}
