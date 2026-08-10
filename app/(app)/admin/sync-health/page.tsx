import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { canManageCompany, type MembershipLike } from "@/lib/auth/roles";
import { getSyncHealthForCompanies } from "@/lib/admin/sync-health";

export default async function SyncHealthPage() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const companyIds = (currentUser.memberships as MembershipLike[])
    .filter((m) => canManageCompany(m))
    .map((m) => m.companyId);

  const health = await getSyncHealthForCompanies(prisma, companyIds);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Xero sync health</h1>
      <div className="mt-6 flex flex-col gap-3">
        {health.map((row) => (
          <div key={row.companyId} className="rounded border border-black/[.08] p-4 text-sm dark:border-white/[.08]">
            <p className="font-medium text-black dark:text-zinc-50">{row.companyName}</p>
            {row.connected ? (
              <>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  Tenant: {row.tenantId} · Token expires {row.tokenExpiresAt?.toISOString()}
                  {row.tokenExpiringSoon && (
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                      expiring soon
                    </span>
                  )}
                </p>
                <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                  Last synced journal #{row.lastJournalNumber ?? "—"}
                  {row.lastSyncedAt ? ` at ${row.lastSyncedAt.toISOString()}` : " (never synced)"}
                </p>
              </>
            ) : (
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">Not connected to Xero.</p>
            )}
          </div>
        ))}
        {health.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No companies to show.</p>
        )}
      </div>
    </div>
  );
}
