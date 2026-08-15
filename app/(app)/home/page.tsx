import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UncertaintyNoteType } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canDo, listAccessibleProjectIds } from "@/lib/authz/service";
import { getIsoWeekKey, getWeekBoundaries } from "@/lib/capture/week-key";
import { isNoteBacked } from "@/lib/compliance/readiness";
import { buildNextActions, type NextAction, type UnloggedProject } from "@/lib/dashboard/tasks";
import { getPortfolioBoardData, type PortfolioCard } from "@/lib/board/portfolio";
import { getAiProviderConfigSummary } from "@/lib/ai/repository";
import { COMPANY_SUGGESTED_QUERIES } from "@/lib/ai/suggested-queries";
import { ArrowRightIcon } from "@/app/components/icons";
import { NAV_GROUPS } from "@/app/components/nav-groups";
import { BoardClient } from "@/app/(app)/board/BoardClient";
import { AiChatPanel } from "@/app/(app)/ai/AiChatPanel";

/** Matches lib/locking's real auto-lock deadline (close + 7 days) — same constant capture/page.tsx uses. */
const AUTO_LOCK_DAYS_AFTER_CLOSE = 7;
const RECENT_ACTIVITY_COUNT = 8;

/** Colour-scale grammar shared with BoardClient.tsx's real board and the pre-login marketing page's illustration — opacity ramps with how hard-won the week's evidence was, not a second hue. Used here for the Latest Activity feed's per-entry dot. */
const CELL_STYLE: Record<UncertaintyNoteType, string> = {
  NO_PROGRESS: "border border-dashed border-black/[.12]",
  ATTEMPT: "bg-accent/40",
  BLOCKER: "bg-accent/60",
  FAILED_ATTEMPT: "bg-accent/80",
  RESOLUTION: "bg-accent",
};

const NOTE_TYPE_LABEL: Record<UncertaintyNoteType, string> = {
  NO_PROGRESS: "no progress",
  ATTEMPT: "tried something",
  BLOCKER: "hit a blocker",
  FAILED_ATTEMPT: "hit a wall",
  RESOLUTION: "solved it",
};

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

  // --- Board preview + latest activity, across every accessible project ---
  const allAccessibleProjectIds = [
    ...new Set((await Promise.all(companyIds.map((companyId) => listAccessibleProjectIds(prisma, { userId: currentUser.id, companyId })))).flat()),
  ];

  // The board is inherently per-company (cards are projects within one company) — feature whichever
  // company has the most recent submission activity, same "recency wins" logic Projects' own
  // /projects redirect uses, rather than trying to merge cards from several companies into one board.
  let homeBoard: { companyId: string; companyName: string; cards: PortfolioCard[] } | null = null;
  if (companyIds.length > 0) {
    const mostRecentlyActive = await prisma.weeklySubmission.findFirst({
      where: { companyId: { in: companyIds } },
      orderBy: { submittedAt: "desc" },
      select: { companyId: true },
    });
    const boardCompanyId = mostRecentlyActive?.companyId ?? companyIds[0];
    const boardProjectIds = await listAccessibleProjectIds(prisma, { userId: currentUser.id, companyId: boardCompanyId });
    if (boardProjectIds.length > 0) {
      const [company, cards] = await Promise.all([
        prisma.company.findUniqueOrThrow({ where: { id: boardCompanyId }, select: { name: true } }),
        getPortfolioBoardData(prisma, { companyId: boardCompanyId, projectIds: boardProjectIds }),
      ]);
      if (cards.length > 0) {
        homeBoard = { companyId: boardCompanyId, companyName: company.name, cards };
      }
    }
  }

  let recentActivity: Array<{ id: string; projectId: string; projectName: string; userName: string; type: UncertaintyNoteType; body: string; weekKey: string }> = [];

  if (allAccessibleProjectIds.length > 0) {
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

  // Same company the board preview features, if there is one — Ask AI is a per-company
  // capability (each company brings its own provider), so it has to pick one.
  const aiCompanyId = homeBoard?.companyId ?? companyIds[0];
  const [aiConfig, canQueryAi, canConfigureAi] = aiCompanyId
    ? await Promise.all([
        getAiProviderConfigSummary(prisma, aiCompanyId),
        canDo(prisma, { userId: currentUser.id, companyId: aiCompanyId, action: "ai:query" }),
        canDo(prisma, { userId: currentUser.id, companyId: aiCompanyId, action: "ai:configure" }),
      ])
    : [null, false, false];

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

  const lockLabel = daysUntilAutoLock <= 0 ? "Locks today" : daysUntilAutoLock === 1 ? "Locks in 1 day" : `Locks in ${daysUntilAutoLock} days`;

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-7 lg:px-12">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <h2 className="m-0 text-[24px] font-[700] tracking-[-0.025em] text-text">Welcome back, {firstName}</h2>
        <div className="flex items-baseline gap-[7px] text-[13px] text-text-secondary">
          <span className="font-[600] text-text">{currentWeekKey}</span>
          <span aria-hidden>·</span>
          <span className={daysUntilAutoLock <= 2 ? "font-[600] text-[#C0392B]" : "font-[500]"}>{lockLabel}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-col divide-y divide-black/[.07] sm:flex-row sm:divide-x sm:divide-y-0">
        {STAT_TILES.map((tile, i) => (
          <div key={tile.label} className={`py-3 sm:flex-1 sm:py-0 sm:pl-6 ${i === 0 ? "sm:pl-0" : ""}`}>
            <p className="m-0 text-[12.5px] font-[500] text-text-secondary">{tile.label}</p>
            <p className="m-0 mt-[3px] text-[25px] font-[650] tracking-[-0.025em] text-text">{tile.value}</p>
            <p className="m-0 mt-[1px] text-[12px] font-[500] text-text-tertiary">{tile.caption}</p>
          </div>
        ))}
      </div>

      <p className="mt-7 mb-[10px] text-[13px] font-[600] tracking-[-0.01em] text-text">Next steps</p>
      {nextActions.length === 0 ? (
        <div className="rounded-[14px] bg-accent-wash px-6 py-5">
          <p className="m-0 text-[14.5px] font-[590] text-accent">You&apos;re all caught up — nothing needs your attention right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-[8px]">
          {nextActions.map((action) => (
            <NextActionCard key={action.kind} action={action} />
          ))}
        </div>
      )}

      {canQueryAi && aiCompanyId && (
        <>
          <p className="mt-7 mb-[10px] text-[13px] font-[600] tracking-[-0.01em] text-text">Ask AI</p>
          <AiChatPanel
            companyId={aiCompanyId}
            suggestedQueries={COMPANY_SUGGESTED_QUERIES}
            configured={aiConfig !== null && aiConfig.enabled && aiConfig.hasApiKey}
            canConfigure={canConfigureAi}
          />
        </>
      )}

      {homeBoard && (
        <>
          <p className="mt-7 mb-[10px] text-[13px] font-[600] tracking-[-0.01em] text-text">
            {companyIds.length > 1 ? `Board — ${homeBoard.companyName}` : "Board"}
          </p>
          <BoardClient companyId={homeBoard.companyId} cards={homeBoard.cards} editableByProject={{}} compact />
        </>
      )}

      {recentActivity.length > 0 && (
        <>
          <p className="mt-7 mb-[10px] text-[13px] font-[600] tracking-[-0.01em] text-text">Latest activity</p>
          <div className="flex flex-col gap-[6px]">
            {recentActivity.map((entry) => (
              <Link
                key={entry.id}
                href={`/projects/${entry.projectId}`}
                className="flex items-start gap-3 rounded-[12px] bg-surface-sunken px-5 py-[14px] transition-colors duration-150 hover:bg-surface-header"
              >
                <span className={`mt-[3px] h-[9px] w-[9px] shrink-0 rounded-[3px] ${CELL_STYLE[entry.type]}`} />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[13.5px] text-text">
                    <span className="font-[590]">{entry.userName}</span> {NOTE_TYPE_LABEL[entry.type]} on <span className="font-[590]">{entry.projectName}</span>
                  </p>
                  <p className="m-0 mt-[3px] truncate text-[12.5px] text-text-secondary">{entry.body}</p>
                </div>
                <span className="shrink-0 text-[11.5px] font-[500] text-text-tertiary">{entry.weekKey}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className="mt-7 mb-[10px] text-[13px] font-[600] tracking-[-0.01em] text-text">Jump to a workspace</p>
      <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-3">
        {NAV_GROUPS.map((group) => (
          <Link
            key={group.label}
            href={group.href}
            className="flex items-center justify-between rounded-[12px] bg-surface-sunken px-5 py-[14px] text-[14px] font-[600] tracking-[-0.01em] text-text transition-colors duration-150 hover:bg-surface-header"
          >
            {group.label}
            <ArrowRightIcon className="shrink-0 text-text-tertiary" />
          </Link>
        ))}
      </div>
    </div>
  );
}

function NextActionCard({ action }: { action: NextAction }) {
  return (
    <Link
      href={action.href}
      className="flex items-center justify-between gap-4 rounded-[14px] bg-surface-sunken px-[22px] py-[16px] transition-colors duration-150 hover:bg-surface-header"
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
