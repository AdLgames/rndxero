import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { isScopedToCompany, type MembershipLike } from "@/lib/auth/roles";
import { getOrCreatePeriodSnapshot } from "@/lib/export/repository";
import { buildCostDetailCsv } from "@/lib/export/csv";
import { renderEvidencePackPdf } from "@/lib/export/pdf";
import type { EvidencePackContent } from "@/lib/export/pack";

/** Generates (or serves the already-frozen) evidence pack for a project/period. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; accountingPeriodId: string }> }
) {
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { projectId, accountingPeriodId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (!isScopedToCompany(currentUser.memberships as MembershipLike[], project.companyId)) {
    return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  }

  const format = request.nextUrl.searchParams.get("format") ?? "pdf";

  const snapshot = await getOrCreatePeriodSnapshot(prisma, {
    projectId,
    accountingPeriodId,
    generatedById: currentUser.id,
  });
  const content = snapshot.dataJson as unknown as EvidencePackContent;

  if (format === "csv") {
    return new NextResponse(buildCostDetailCsv(content), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${projectId}-${accountingPeriodId}-cost-detail.csv"`,
      },
    });
  }

  const pdf = await renderEvidencePackPdf(content, {
    snapshotHash: snapshot.snapshotHash,
    generatedAt: new Date(),
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${projectId}-${accountingPeriodId}-evidence-pack.pdf"`,
    },
  });
}
