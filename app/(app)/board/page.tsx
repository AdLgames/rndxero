import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canDo, listAccessibleProjectIds } from "@/lib/authz/service";
import { getPortfolioBoardData } from "@/lib/board/portfolio";
import { BoardClient } from "./BoardClient";

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const companyIds = [...new Set(currentUser.memberships.map((m) => m.companyId))];
  if (companyIds.length === 0) {
    return (
      <div className="px-4 py-8 sm:px-8 sm:py-11 lg:px-12">
        <p className="text-[15px] text-text-secondary">You&apos;re not a member of any company yet.</p>
      </div>
    );
  }

  const params = await searchParams;
  const companyId = params.company && companyIds.includes(params.company) ? params.company : companyIds[0];
  const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });

  const accessibleProjectIds = await listAccessibleProjectIds(prisma, { userId: currentUser.id, companyId });
  const projects = await prisma.project.findMany({
    where: { id: { in: accessibleProjectIds } },
    select: { id: true },
  });
  const readableProjectIds = await Promise.all(
    projects.map(async (p) => ({
      id: p.id,
      readable: await canDo(prisma, { userId: currentUser.id, companyId, projectId: p.id, action: "project:read" }),
      editable: await canDo(prisma, { userId: currentUser.id, companyId, projectId: p.id, action: "project:update" }),
    }))
  );
  const projectIds = readableProjectIds.filter((p) => p.readable).map((p) => p.id);
  const editableByProject = Object.fromEntries(readableProjectIds.map((p) => [p.id, p.editable]));

  if (projectIds.length === 0) {
    return (
      <div className="px-4 py-8 sm:px-8 sm:py-11 lg:px-12">
        <h2 className="m-0 mb-7 text-[30px] font-[640] tracking-[-0.028em] text-text">Board</h2>
        <p className="text-[15px] text-text-secondary">No projects to show yet.</p>
      </div>
    );
  }

  const cards = await getPortfolioBoardData(prisma, { companyId, projectIds });

  return (
    <div className="px-4 py-8 sm:px-8 sm:py-11 lg:px-12">
      <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">{companyIds.length > 1 ? `Board — ${company.name}` : "Board"}</h2>
      <p className="m-0 mt-[7px] mb-7 max-w-[58ch] text-[15px] leading-[1.5] text-text-secondary">
        Every project, grouped by where it stands. Drag a card to move it between stages.
      </p>

      <BoardClient companyId={companyId} cards={cards} editableByProject={editableByProject} />
    </div>
  );
}
