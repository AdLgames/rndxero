import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getSyncHealthForCompanies } from "@/lib/admin/sync-health";

export default async function SyncHealthPage() {
  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const companyIds = currentUser.memberships
    .filter((m) => m.role === "OWNER")
    .map((m) => m.companyId);

  const health = await getSyncHealthForCompanies(prisma, companyIds);

  return (
    <div className="px-4 py-8 sm:px-8 sm:py-11 lg:px-12">
      <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">Xero sync health</h2>
      <div className="mt-8 flex flex-col gap-[10px]">
        {health.map((row) => (
          <div key={row.companyId} className="rounded-[14px] border border-black/[.06] bg-surface-sunken px-[22px] py-5">
            <p className="m-0 text-[15px] font-[600] tracking-[-0.02em] text-text">{row.companyName}</p>
            {row.connected ? (
              <>
                <p className="m-0 mt-[6px] text-[13px] text-text-tertiary">
                  Tenant: {row.tenantId} · Token expires {row.tokenExpiresAt?.toISOString()}
                  {row.tokenExpiringSoon && (
                    <span className="ml-2 rounded-full bg-[#FDF3E7] px-[9px] py-[3px] text-[11px] font-[590] text-[#8A5A15]">expiring soon</span>
                  )}
                </p>
                <p className="m-0 mt-1 text-[13px] text-text-tertiary">
                  Last synced journal #{row.lastJournalNumber ?? "—"}
                  {row.lastSyncedAt ? ` at ${row.lastSyncedAt.toISOString()}` : " (never synced)"}
                </p>
              </>
            ) : (
              <p className="m-0 mt-[6px] text-[13px] text-text-tertiary">Not connected to Xero.</p>
            )}
          </div>
        ))}
        {health.length === 0 && <p className="text-[14px] text-text-secondary">No companies to show.</p>}
      </div>
    </div>
  );
}
