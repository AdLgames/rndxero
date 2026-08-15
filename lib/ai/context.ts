import type { PrismaClient } from "@/lib/generated/prisma/client";
import { getProjectClaimPack } from "@/lib/export/pack";
import { getCompanySummary } from "@/lib/compliance/summary";
import { hasEvidenceLink, hasNarrative } from "@/lib/compliance/readiness";

function hoursLabel(minutes: number): string {
  return (minutes / 60).toFixed(1);
}

/**
 * Grounds "what's missing" answers in real computed facts rather than
 * letting the model guess — the gap counts here come from the same
 * hasNarrative/hasEvidenceLink checks the project page's own "missing
 * evidence" banner uses, not an LLM's impression of the text.
 */
export async function buildProjectContext(prisma: PrismaClient, projectId: string): Promise<string> {
  const pack = await getProjectClaimPack(prisma, { projectId, includeCosts: false });
  const lines: string[] = [];

  lines.push(`Project: ${pack.project.name}`);
  lines.push(`Status: ${pack.project.status}`);
  if (pack.project.description) lines.push(`Description: ${pack.project.description}`);
  lines.push(`Competent professionals named: ${pack.project.competentProfessionals.join(", ") || "none named"}`);
  lines.push(`Total hours logged: ${hoursLabel(pack.totals.actualMinutes)}h; planned: ${hoursLabel(pack.totals.plannedMinutes)}h`);
  lines.push("");
  lines.push("Technical challenges (uncertainties) and their evidence trail:");

  if (pack.uncertainties.length === 0) {
    lines.push("(No technical challenges recorded yet.)");
  }

  for (const u of pack.uncertainties) {
    lines.push(`- "${u.title}" (${u.outcome})`);
    lines.push(`  Baseline (existing state of knowledge): ${u.baseline || "MISSING — no baseline recorded"}`);
    const notes = u.chronology.filter((n) => n.type !== "NO_PROGRESS");
    const missingNarrative = notes.filter((n) => !hasNarrative(n)).length;
    const missingEvidence = notes.filter((n) => !hasEvidenceLink(n)).length;
    lines.push(
      `  ${notes.length} logged note(s); ${missingNarrative} missing a substantive narrative; ${missingEvidence} missing a linked piece of evidence.`
    );
  }

  return lines.join("\n");
}

export async function buildCompanyContext(prisma: PrismaClient, companyId: string): Promise<string> {
  const [summary, projects] = await Promise.all([
    getCompanySummary(prisma, companyId),
    prisma.project.findMany({ where: { companyId }, select: { name: true, status: true }, orderBy: { createdAt: "desc" } }),
  ]);

  const lines: string[] = [];
  lines.push("Company-wide summary for the current year:");
  lines.push(`- Total hours logged: ${hoursLabel(summary.totalMinutesYtd)}h`);
  lines.push(`- Qualifying expenditure logged: £${(summary.qualifyingExpenditureMinorUnits / 100).toFixed(0)}`);
  lines.push(`- Audit readiness (share of notes with both a narrative and linked evidence): ${summary.auditReadinessPct}%`);
  lines.push(`- Projects: ${projects.length} total, ${projects.filter((p) => p.status === "ACTIVE").length} active`);
  for (const p of projects) lines.push(`  - ${p.name} (${p.status})`);

  return lines.join("\n");
}
