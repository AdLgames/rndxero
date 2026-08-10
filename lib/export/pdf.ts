import PDFDocument from "pdfkit";
import type { EvidencePackContent } from "@/lib/export/pack";

function formatMinorUnits(minorUnits: number, currency: string): string {
  return `${(minorUnits / 100).toFixed(2)} ${currency}`;
}

function formatMinutes(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

/**
 * Renders the evidence pack as a PDF. Organised for a human reviewer —
 * HMRC does not mandate a template (PLAN.md Phase 5) — not to mimic any
 * official form. This has no opinion on formatting beyond readability;
 * every figure it prints comes straight from `content`, nothing is
 * recomputed here.
 */
export function renderEvidencePackPdf(
  content: EvidencePackContent,
  meta: { snapshotHash: string; generatedAt: Date }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text(content.project.name, { continued: false });
    doc.fontSize(11).fillColor("#555").text(`R&D Evidence Pack — ${content.accountingPeriod.label}`);
    doc.moveDown();

    doc.fillColor("#000").fontSize(13).text("Project summary");
    doc.fontSize(10).fillColor("#333");
    doc.text(`Status: ${content.project.status}`);
    doc.text(`Period: ${content.accountingPeriod.startDate} to ${content.accountingPeriod.endDate}`);
    doc.text(
      `Competent professional(s): ${content.project.competentProfessionals.join(", ") || "none named"}`
    );
    doc.moveDown();

    doc.fillColor("#000").fontSize(13).text("Evidence timeline");
    doc.fontSize(10).fillColor("#333");
    if (content.evidenceTimeline.length === 0) {
      doc.text("No evidence recorded for this period.");
    }
    for (const entry of content.evidenceTimeline) {
      doc.text(`[${entry.createdAt}] ${entry.type} — ${entry.authorName}`, { continued: false });
      doc.text(entry.body, { indent: 12 });
      if (entry.supersedes) {
        doc.fillColor("#777").text(`(supersedes ${entry.supersedes})`, { indent: 12 });
        doc.fillColor("#333");
      }
      doc.moveDown(0.5);
    }
    doc.moveDown();

    doc.fillColor("#000").fontSize(13).text("Time summary");
    doc.fontSize(10).fillColor("#333");
    if (content.timeSummary.length === 0) {
      doc.text("No time logged for this period.");
    }
    for (const row of content.timeSummary) {
      const basisLine = Object.entries(row.basisBreakdownMinutes)
        .map(([basis, minutes]) => `${basis.toLowerCase()}: ${formatMinutes(minutes)}`)
        .join(", ");
      doc.text(`${row.personName}: ${formatMinutes(row.totalMinutes)} total (${basisLine})`);
    }
    doc.moveDown();

    doc.fillColor("#000").fontSize(13).text("Cost summary");
    doc.fontSize(10).fillColor("#333");
    if (content.costSummary.length === 0) {
      doc.text("No costs allocated for this period.");
    }
    for (const line of content.costSummary) {
      const reference =
        line.source.type === "xero"
          ? `Xero journal ${line.source.xeroJournalId} / line ${line.source.xeroJournalLineId}`
          : `manual import: ${line.source.filename}`;
      doc.text(
        `${line.category ?? "uncategorised"} — ${line.description}: ${formatMinorUnits(
          line.apportionedAmountMinorUnits,
          line.currency
        )} (${(line.apportionmentBps / 100).toFixed(2)}% of ${formatMinorUnits(
          line.amountMinorUnits,
          line.currency
        )})`
      );
      doc.fillColor("#777").text(`Source: ${reference}`, { indent: 12 });
      doc.text(`Rationale: ${line.rationale}`, { indent: 12 });
      doc.fillColor("#333");
      doc.moveDown(0.5);
    }
    doc.moveDown();

    doc.fillColor("#000").fontSize(13).text("Approval history");
    doc.fontSize(10).fillColor("#333");
    if (content.approvalHistory.length === 0) {
      doc.text("No approvals recorded for this period.");
    }
    for (const approval of content.approvalHistory) {
      doc.text(
        `[${approval.createdAt}] ${approval.targetType} ${approval.targetId}: ${approval.decision} by ${approval.approverName}${approval.comment ? ` — "${approval.comment}"` : ""}`
      );
    }
    doc.moveDown();

    doc.fontSize(9).fillColor("#777");
    doc.text(`Snapshot hash: ${meta.snapshotHash}`);
    doc.text(`Generated: ${meta.generatedAt.toISOString()}`);

    doc.end();
  });
}
