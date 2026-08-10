import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseSalaryCsv } from "@/lib/xero/salary-import";
import { saveSalaryImport } from "@/lib/xero/repository";

/**
 * Uploads a salary/cost CSV as the primary staff-cost path (payroll API
 * access is restricted and region-dependent — see PLAN.md Phase 3 §5).
 * Body: multipart/form-data with `file`, `companyId`, `importedById`.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  const companyId = form.get("companyId");
  const importedById = form.get("importedById");

  if (!(file instanceof File) || typeof companyId !== "string" || typeof importedById !== "string") {
    return NextResponse.json(
      { error: "file, companyId and importedById are required" },
      { status: 400 }
    );
  }

  const csvText = await file.text();
  const { lines, errors } = parseSalaryCsv(csvText);

  if (lines.length === 0) {
    return NextResponse.json({ error: "No valid rows", errors }, { status: 422 });
  }

  const saved = await saveSalaryImport(prisma, {
    companyId,
    filename: file.name,
    importedById,
    lines,
  });

  return NextResponse.json({ import: saved, errors }, { status: 201 });
}
