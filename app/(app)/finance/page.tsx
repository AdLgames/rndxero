import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { FinanceWeeksClient, type SubmissionRow } from "./FinanceWeeksClient";

export default async function FinancePage() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  // Locking/amendment is Owner/Finance only (BOARD-PLAN.md Phase 4.3: "finance-only") —
  // the permission matrix agrees (lib/authz/permissions.ts), this just avoids showing
  // the page to someone every action on it would 403 for.
  const financeCompanyIds = currentUser.memberships
    .filter((m) => m.role === "OWNER" || m.role === "FINANCE")
    .map((m) => m.companyId);

  if (financeCompanyIds.length === 0) {
    return (
      <div className="mx-auto max-w-[880px] px-12 py-13">
        <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">Finance</h2>
        <p className="m-0 mt-3 text-[15px] leading-[1.5] text-text-secondary">
          You need to be an Owner or Finance member of a company to lock weeks or review amendments.
        </p>
      </div>
    );
  }

  const submissions = await prisma.weeklySubmission.findMany({
    where: { companyId: { in: financeCompanyIds } },
    include: {
      project: { select: { id: true, name: true, companyId: true } },
      user: { select: { name: true, email: true } },
      notes: {
        include: {
          uncertainty: { select: { title: true } },
          amendments: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
        },
      },
    },
    orderBy: [{ weekKey: "desc" }, { submittedAt: "desc" }],
    take: 200,
  });

  const submissionAmendments = await prisma.amendment.findMany({
    where: { submissionId: { in: submissions.map((s) => s.id) } },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const lockAuditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "WeeklySubmission",
      entityId: { in: submissions.map((s) => s.id) },
      action: { in: ["submission.lock", "submission.unlock", "submission.auto_lock"] },
    },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const companies = await prisma.company.findMany({ where: { id: { in: financeCompanyIds } } });
  const companyNameById = new Map(companies.map((c) => [c.id, c.name]));

  const rows: SubmissionRow[] = submissions.map((s) => ({
    id: s.id,
    companyId: s.companyId,
    companyName: companyNameById.get(s.companyId) ?? "",
    projectId: s.projectId,
    projectName: s.project.name,
    userName: s.user.name,
    userEmail: s.user.email,
    weekKey: s.weekKey,
    minutes: s.minutes,
    basis: s.basis,
    submittedAt: s.submittedAt.toISOString(),
    isRetrospective: s.isRetrospective,
    lockedAt: s.lockedAt ? s.lockedAt.toISOString() : null,
    notes: s.notes.map((n) => ({
      id: n.id,
      type: n.type,
      body: n.body,
      uncertaintyTitle: n.uncertainty.title,
      amendments: n.amendments.map((a) => ({
        id: a.id,
        body: a.body,
        authorName: a.author.name,
        createdAt: a.createdAt.toISOString(),
      })),
    })),
    amendments: submissionAmendments
      .filter((a) => a.submissionId === s.id)
      .map((a) => ({ id: a.id, body: a.body, authorName: a.author.name, createdAt: a.createdAt.toISOString() })),
    lockHistory: lockAuditLogs
      .filter((log) => log.entityId === s.id)
      .map((log) => ({
        id: log.id,
        action: log.action as "submission.lock" | "submission.unlock" | "submission.auto_lock",
        actorName: log.actor?.name ?? null,
        reason: log.reason,
        createdAt: log.createdAt.toISOString(),
      })),
  }));

  return (
    <div className="mx-auto max-w-[880px] px-12 py-13">
      <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">Finance</h2>
      <p className="m-0 mt-3 mb-8 text-[15px] leading-[1.5] text-text-secondary">
        Lock weeks once they&apos;re settled. After that the only correction is an attributed amendment — the
        original stays exactly as submitted.
      </p>
      <FinanceWeeksClient submissions={rows} />
    </div>
  );
}
