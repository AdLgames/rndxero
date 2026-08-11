import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { AuthorizationError, authorize, canDo } from "@/lib/authz/service";
import { getProjectClaimPack } from "@/lib/export/pack";
import { renderClaimPackPdf } from "@/lib/export/pdf";
import { buildClaimPackCsv } from "@/lib/export/csv";

/** Claim pack export (BOARD-PLAN.md Phase 7) — ?companyId=&format=pdf|csv|json, json by default. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const currentUser = await getCurrentUser(prisma, request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!currentUser) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const companyId = request.nextUrl.searchParams.get("companyId");
  const format = request.nextUrl.searchParams.get("format") ?? "json";
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }
  if (!["pdf", "csv", "json"].includes(format)) {
    return NextResponse.json({ error: "format must be pdf, csv or json" }, { status: 400 });
  }

  try {
    await authorize(prisma, { userId: currentUser.id, companyId, projectId, action: "export:read" });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: "Not permitted to export this project" }, { status: 403 });
    }
    throw error;
  }

  const includeCosts = await canDo(prisma, { userId: currentUser.id, companyId, projectId, action: "cost:read" });
  const content = await getProjectClaimPack(prisma, { projectId, includeCosts });

  if (format === "json") {
    return NextResponse.json(content);
  }
  if (format === "csv") {
    return new NextResponse(buildClaimPackCsv(content), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${content.project.name.replace(/[^a-z0-9]+/gi, "-")}-claim-pack.csv"`,
      },
    });
  }

  const pdf = await renderClaimPackPdf(content);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${content.project.name.replace(/[^a-z0-9]+/gi, "-")}-claim-pack.pdf"`,
    },
  });
}
