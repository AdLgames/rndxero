import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { listAccessibleProjectIds } from "@/lib/authz/service";
import { SearchClient } from "./SearchClient";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
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

  const accessibleProjectIds = await listAccessibleProjectIds(prisma, { userId: currentUser.id, companyId });
  const projects = await prisma.project.findMany({
    where: { id: { in: accessibleProjectIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-[880px] px-4 py-8 sm:px-8 sm:py-11 lg:px-12 lg:py-13">
      <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">Search</h2>
      <p className="m-0 mt-3 mb-8 text-[15px] leading-[1.5] text-text-secondary">
        Find narrative entries across every project you can see — &quot;every failed attempt on the caching layer,&quot; a
        specific error message, a person&apos;s name.
      </p>
      <SearchClient companyId={companyId} projects={projects} />
    </div>
  );
}
