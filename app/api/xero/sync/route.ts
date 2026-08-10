import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncCompanyJournals } from "@/lib/xero/sync";

/** Triggers (or resumes) a GL mirror backfill for a company. */
export async function POST(request: NextRequest) {
  const { companyId } = (await request.json()) as { companyId?: string };
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  try {
    const result = await syncCompanyJournals(prisma, companyId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
