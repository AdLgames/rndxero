import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canApprove, type MembershipLike } from "@/lib/auth/roles";
import {
  getPendingApprovalQueue,
  getProjectCostEvidenceSummary,
  getProjectTimeEvidenceSummary,
} from "@/lib/approvals/repository";
import { QueueItemRow } from "./QueueItemRow";

export default async function FinanceQueuePage() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const approverCompanyIds = (currentUser.memberships as MembershipLike[])
    .filter((m) => canApprove(m))
    .map((m) => m.companyId);

  const companies = await prisma.company.findMany({
    where: { id: { in: approverCompanyIds } },
    include: { projects: { where: { status: "ACTIVE" } } },
  });

  const queueByCompany = await Promise.all(
    companies.map(async (company) => ({
      company,
      queue: await getPendingApprovalQueue(prisma, company.id),
      unevidenced: await Promise.all(
        company.projects.map(async (project) => ({
          project,
          time: await getProjectTimeEvidenceSummary(prisma, project.id),
          cost: await getProjectCostEvidenceSummary(prisma, project.id),
        }))
      ),
    }))
  );

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Finance review</h1>

      {queueByCompany.map(({ company, queue, unevidenced }) => (
        <section key={company.id} className="mt-8">
          <h2 className="text-base font-medium text-black dark:text-zinc-50">{company.name}</h2>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {unevidenced.map(({ project, time, cost }) => (
              <div
                key={project.id}
                className="rounded border border-black/[.08] p-3 text-sm dark:border-white/[.08]"
              >
                <p className="font-medium text-black dark:text-zinc-50">{project.name}</p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  Unevidenced: {(time.unevidencedMinutes / 60).toFixed(1)}h ·{" "}
                  {(cost.unevidencedMinorUnits / 100).toFixed(2)} unallocated cost
                </p>
              </div>
            ))}
          </div>

          <ul className="mt-4">
            {queue.length === 0 && (
              <li className="py-3 text-sm text-zinc-500 dark:text-zinc-400">Nothing pending review.</li>
            )}
            {queue.map((item) => (
              <QueueItemRow
                key={`${item.targetType}-${item.targetId}`}
                companyId={company.id}
                targetType={item.targetType}
                targetId={item.targetId}
                projectName={item.projectName}
                summary={item.summary}
              />
            ))}
          </ul>
        </section>
      ))}

      {queueByCompany.length === 0 && (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          No companies to review yet.
        </p>
      )}
    </div>
  );
}
