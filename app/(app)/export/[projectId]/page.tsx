import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize, canDo } from "@/lib/authz/service";
import { getProjectClaimPack } from "@/lib/export/pack";
import { eyebrow } from "@/app/components/ui";
import { ExportActions } from "./ExportActions";

function hoursLabel(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

export default async function ExportPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const cookieStore = await cookies();
  const currentUser = await getCurrentUser(prisma, cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    redirect("/login");
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();

  try {
    await authorize(prisma, { userId: currentUser.id, companyId: project.companyId, projectId, action: "export:read" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return (
        <div className="px-12 py-11">
          <p className="text-[15px] text-text-secondary">You don&apos;t have access to export this project.</p>
        </div>
      );
    }
    throw error;
  }

  const includeCosts = await canDo(prisma, { userId: currentUser.id, companyId: project.companyId, projectId, action: "cost:read" });
  const pack = await getProjectClaimPack(prisma, { projectId, includeCosts });

  const weekKeys = new Set(pack.integrity.map((row) => row.weekKey));
  const lockedWeeks = pack.integrity.filter((row) => row.lockedAt !== null).length;
  const amendmentCount =
    pack.integrity.reduce((sum, row) => sum + row.amendments.length, 0) +
    pack.uncertainties.reduce((sum, u) => sum + u.chronology.reduce((s, e) => s + e.amendments.length, 0), 0);

  const downloadUrl = `/api/export/${projectId}?companyId=${project.companyId}`;
  const filenameBase = `${project.name.replace(/[^a-z0-9]+/gi, "-")}-claim-pack`;

  return (
    <div className="px-12 py-11">
      <h2 className="m-0 text-[30px] font-[640] tracking-[-0.028em] text-text">{project.name}</h2>
      <p className="m-0 mt-[7px] max-w-[62ch] text-[15px] leading-[1.5] text-text-secondary">
        A claim pack for this project: the per-uncertainty evidence narrative, plan-vs-actual, and integrity
        metadata.
      </p>

      <div className="mt-[10px] rounded-[10px] border border-accent-border bg-accent-wash px-4 py-3 text-[13px] leading-[1.5] text-text-secondary">
        This is a contemporaneous record of work and evidence, not a claim. It does not determine R&amp;D tax relief
        eligibility, decide what qualifies as R&amp;D, or calculate any relief value.
      </div>

      <div className="mt-8 grid grid-cols-[1fr_1fr] items-start gap-[26px]">
        <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-[26px]">
          <h5 className="m-0 mb-[6px] text-[15px] font-[600] tracking-[-0.02em] text-text">What to export</h5>
          <p className="m-0 mb-5 text-[13.5px] leading-[1.5] text-text-secondary">
            Includes every logged week, planned-vs-actual, corrections and amendments, competent professionals, and
            uncertainty narratives for this project.
          </p>
          <ExportActions downloadUrl={downloadUrl} filenameBase={filenameBase} />
        </div>

        <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-[26px]">
          <p className={`m-0 mb-1 ${eyebrow}`}>Preview</p>
          <p className="m-0 mb-4 text-[15.5px] font-[600] tracking-[-0.02em] text-text">{project.name}</p>
          <dl className="m-0">
            {[
              ["Weeks covered", weekKeys.size.toString()],
              ["Uncertainties", pack.uncertainties.length.toString()],
              ["Total logged", hoursLabel(pack.totals.actualMinutes)],
              ["Planned", hoursLabel(pack.totals.plannedMinutes)],
              ["Locked weeks", `${lockedWeeks} / ${weekKeys.size}`],
              ["Amendments", amendmentCount.toString()],
              ...(includeCosts && pack.totals.derivedCostMinorUnits !== null
                ? ([["Derived cost", `£${(pack.totals.derivedCostMinorUnits / 100).toFixed(2)}`]] as const)
                : []),
            ].map(([key, value], i, arr) => (
              <div key={key} className={`flex items-center justify-between py-[11px] text-[14px] ${i < arr.length - 1 ? "border-b border-black/[.05]" : ""}`}>
                <dt className="text-text-secondary">{key}</dt>
                <dd className="m-0 font-[500] text-text">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <p className={`mt-9 mb-3 ${eyebrow}`}>Uncertainty narratives</p>
      <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
        {pack.uncertainties.map((u) => (
          <li key={u.id} className="rounded-[14px] border border-black/[.06] bg-surface-sunken px-[18px] py-4">
            <p className="m-0 text-[14.5px] font-[600] tracking-[-0.02em] text-text">{u.title}</p>
            <p className="m-0 mt-1 text-[13px] text-text-tertiary">
              {u.outcome} · {hoursLabel(u.totalMinutes)} attributed · {u.chronology.length} entr{u.chronology.length === 1 ? "y" : "ies"}
            </p>
          </li>
        ))}
        {pack.uncertainties.length === 0 && <li className="text-[14px] text-text-secondary">No uncertainties recorded yet.</li>}
      </ul>
    </div>
  );
}
