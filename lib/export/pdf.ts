import PDFDocument from "pdfkit";
import type { ClaimPackContent } from "@/lib/export/pack";

const DISCLAIMER =
  "This is a contemporaneous record of work and evidence, not a claim. It does not determine R&D tax relief eligibility, decide what qualifies as R&D, or calculate any relief value.";

function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

function formatMoney(minorUnits: number): string {
  return `£${(minorUnits / 100).toFixed(2)}`;
}

function stampFooterDisclaimer(doc: PDFKit.PDFDocument): void {
  const savedX = doc.x;
  const savedY = doc.y;
  const bottomMargin = doc.page.margins.bottom;
  // Writing this close to the page edge would otherwise read as an overflow to
  // pdfkit's auto-pagination, which calls addPage() — which re-emits the very
  // 'pageAdded' event this function is called from, recursing until the stack
  // blows. Zeroing the bottom margin for the duration of this one write is the
  // standard pdfkit footer workaround: it stops that overflow check from firing.
  doc.page.margins.bottom = 0;
  doc
    .fontSize(7)
    .fillColor("#999")
    .text(DISCLAIMER, doc.page.margins.left, doc.page.height - bottomMargin + 12, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      align: "center",
    });
  doc.page.margins.bottom = bottomMargin;
  doc.x = savedX;
  doc.y = savedY;
  doc.fillColor("#000");
}

/**
 * Renders the claim pack as a PDF (BOARD-PLAN.md Phase 7): per-uncertainty
 * narrative (baseline → chronological attempts, including failures →
 * resolution/abandonment → hours/cost), a project roll-up with
 * plan-vs-actual and revision history, and an integrity appendix. The
 * non-claim disclaimer is stamped on every page's footer (Phase 7.5) via
 * pdfkit's pageAdded event, plus called once up front for the first page
 * (which exists before that listener can be attached) — and printed
 * prominently near the top too, not just in the footer.
 *
 * Every figure printed here comes straight from `content` — nothing is
 * recomputed, matching the same discipline as the v1 evidence pack
 * renderer this supersedes.
 */
export function renderClaimPackPdf(content: ClaimPackContent): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.on("pageAdded", () => stampFooterDisclaimer(doc));

    doc.fontSize(18).fillColor("#000").text(content.project.name);
    doc.fontSize(11).fillColor("#555").text("R&D Evidence — Claim Pack");
    doc.moveDown(0.5);

    doc
      .fontSize(9)
      .fillColor("#a00")
      .rect(doc.x, doc.y, doc.page.width - doc.page.margins.left - doc.page.margins.right, 28)
      .stroke("#a00");
    doc.text(DISCLAIMER, doc.x + 8, doc.y + 6, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 16 });
    doc.fillColor("#000");
    doc.moveDown(1.5);

    doc.fontSize(13).text("Project summary");
    doc.fontSize(10).fillColor("#333");
    doc.text(`Status: ${content.project.status}`);
    if (content.project.description) doc.text(`Description: ${content.project.description}`);
    doc.text(
      `Period: ${content.project.startDate.slice(0, 10)}${content.project.endDate ? ` to ${content.project.endDate.slice(0, 10)}` : " (ongoing)"}`
    );
    doc.text(`Competent professional(s): ${content.project.competentProfessionals.join(", ") || "none named"}`);
    doc.text(
      `Total: ${formatHours(content.totals.actualMinutes)} logged against ${formatHours(content.totals.plannedMinutes)} currently planned` +
        (content.includesCosts && content.totals.derivedCostMinorUnits !== null
          ? ` · ${formatMoney(content.totals.derivedCostMinorUnits)} derived labour cost`
          : "")
    );
    doc.fillColor("#000");
    doc.moveDown();

    for (const u of content.uncertainties) {
      doc.fontSize(13).fillColor("#000").text(u.title);
      doc.fontSize(10).fillColor("#333");
      doc.text(`Baseline: ${u.baseline}`);
      if (u.description) doc.text(`Description: ${u.description}`);
      doc.text(
        `Raised ${u.raisedWeek} · ${u.outcome}${u.resolvedWeek ? ` (${u.resolvedWeek})` : ""} · ${formatHours(u.totalMinutes)} attributed` +
          (content.includesCosts && u.derivedCostMinorUnits !== null ? ` · ${formatMoney(u.derivedCostMinorUnits)}` : "")
      );
      doc.moveDown(0.3);

      if (u.chronology.length === 0) {
        doc.fillColor("#777").text("No entries recorded.");
      }
      for (const entry of u.chronology) {
        const flags = [entry.isRetrospective ? "retrospective" : null, entry.locked ? `sealed ${entry.lockedAt?.slice(0, 10)}` : null]
          .filter(Boolean)
          .join(", ");
        doc.fillColor("#333").text(`[${entry.weekKey}] ${entry.type}${entry.minutes !== null ? ` (${formatHours(entry.minutes)})` : ""}${flags ? ` — ${flags}` : ""}`);
        doc.text(entry.body, { indent: 12 });
        for (const amendment of entry.amendments) {
          doc.fillColor("#a60").text(`Correction (${amendment.authorName}, ${amendment.createdAt.slice(0, 10)}): ${amendment.body}`, { indent: 12 });
          doc.fillColor("#333");
        }
        doc.moveDown(0.4);
      }
      doc.fillColor("#000");
      doc.moveDown();
    }

    doc.addPage();
    doc.fontSize(13).fillColor("#000").text("Plan-vs-actual variance");
    doc.fontSize(10).fillColor("#333");
    if (content.variance.length === 0) {
      doc.text("No plan or actuals recorded.");
    }
    for (const row of content.variance) {
      const sign = row.varianceMinutes > 0 ? "+" : "";
      doc.text(
        `${row.uncertaintyTitle} — ${row.weekKey}: planned ${formatHours(row.plannedMinutes)}, actual ${formatHours(row.actualMinutes)} (${sign}${formatHours(row.varianceMinutes)})`
      );
    }
    doc.fillColor("#000");
    doc.moveDown();

    doc.fontSize(13).text("Plan revision history");
    doc.fontSize(10).fillColor("#333");
    if (content.planRevisions.length === 0) {
      doc.text("No plan was ever created for this project.");
    }
    for (const v of content.planRevisions) {
      doc.text(
        `Version ${v.versionNumber} by ${v.createdByName}, ${v.createdAt.slice(0, 10)} — ${formatHours(v.totalPlannedMinutes)} planned` +
          (v.supersededAt ? ` (superseded ${v.supersededAt.slice(0, 10)})` : " (current)") +
          (v.note ? ` — "${v.note}"` : "")
      );
    }
    doc.fillColor("#000");
    doc.moveDown();

    doc.fontSize(13).text("Integrity — every submitted week");
    doc.fontSize(10).fillColor("#333");
    if (content.integrity.length === 0) {
      doc.text("No weeks submitted.");
    }
    for (const row of content.integrity) {
      const flags = [row.isRetrospective ? "retrospective" : null, row.lockedAt ? `sealed ${row.lockedAt.slice(0, 10)}` : "unlocked"]
        .filter(Boolean)
        .join(", ");
      doc.text(`${row.weekKey} — ${row.userName}: ${formatHours(row.minutes)} (${row.basis.toLowerCase()}), submitted ${row.submittedAt.slice(0, 10)} — ${flags}`);
      for (const amendment of row.amendments) {
        doc.fillColor("#a60").text(`Correction (${amendment.authorName}, ${amendment.createdAt.slice(0, 10)}): ${amendment.body}`, { indent: 12 });
        doc.fillColor("#333");
      }
    }
    doc.fillColor("#000");
    doc.moveDown();

    doc.fontSize(13).fillColor("#000").text("Audit trail");
    doc.fontSize(10).fillColor("#333");
    if (content.auditTrail.length === 0) {
      doc.text("No logged changes.");
    }
    for (const entry of content.auditTrail) {
      doc.text(
        `${entry.createdAt.slice(0, 10)} — ${entry.action} on ${entry.entityType} (${entry.actorName ?? "system"})` +
          (entry.reason ? ` — ${entry.reason}` : "")
      );
    }
    doc.fillColor("#000");
    doc.moveDown();

    doc.fontSize(8).fillColor("#777").text(`Generated: ${content.generatedAt}`);

    doc.end();
  });
}
