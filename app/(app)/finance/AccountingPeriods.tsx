"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/app/components/icons";
import { buttonGhost, buttonPrimary, buttonSecondary, fieldLabel, input } from "@/app/components/ui";

export interface AccountingPeriodRow {
  id: string;
  companyId: string;
  companyName: string;
  label: string;
  startDate: string;
  endDate: string;
  claimNotifiedAt: string | null;
  /** Pre-computed server-side from lib/compliance/deadlines — 6 months after endDate. */
  notificationDeadline: string;
  daysUntilDeadline: number;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function DeadlineBadge({ row }: { row: AccountingPeriodRow }) {
  if (row.claimNotifiedAt) {
    return <span className="text-[12.5px] text-text-tertiary">Notified {fmtDate(row.claimNotifiedAt)}</span>;
  }
  if (row.daysUntilDeadline < 0) {
    return <span className="text-[12.5px] font-[590] text-[#C0392B]">Notification deadline passed</span>;
  }
  if (row.daysUntilDeadline <= 30) {
    return <span className="text-[12.5px] font-[590] text-[#C0392B]">Notify HMRC within {row.daysUntilDeadline}d</span>;
  }
  if (row.daysUntilDeadline <= 90) {
    return <span className="text-[12.5px] font-[590] text-[#C88A1E]">Notification due {fmtDate(row.notificationDeadline)}</span>;
  }
  return <span className="text-[12.5px] text-text-tertiary">Notification due {fmtDate(row.notificationDeadline)}</span>;
}

function PeriodRow({ row, canWrite }: { row: AccountingPeriodRow; canWrite: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggleNotified() {
    setBusy(true);
    try {
      await fetch(`/api/accounting-periods/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: row.companyId, notified: !row.claimNotifiedAt }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-4 px-5 py-[13px]">
      <div className="min-w-0">
        <p className="m-0 text-[13.5px] font-[590] text-text">{row.label}</p>
        <p className="m-0 mt-[2px] text-[12px] text-text-quaternary">
          {fmtDate(row.startDate)} – {fmtDate(row.endDate)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <DeadlineBadge row={row} />
        {canWrite && (
          <button type="button" onClick={toggleNotified} disabled={busy} className={buttonGhost}>
            {busy && <Spinner />}
            {row.claimNotifiedAt ? "Undo" : "Mark notified"}
          </button>
        )}
      </div>
    </div>
  );
}

export function AccountingPeriods({ companyId, periods, canWrite }: { companyId: string; periods: AccountingPeriodRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  async function save() {
    if (!label.trim() || !startDate || !endDate) {
      setStatus("error");
      setError("Label, start date, and end date are required");
      return;
    }
    setStatus("saving");
    setError("");
    try {
      const response = await fetch("/api/accounting-periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, label, startDate, endDate }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not save");
      }
      setAdding(false);
      setLabel("");
      setStartDate("");
      setEndDate("");
      setStatus("idle");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {periods.length > 0 && (
        <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken">
          {periods.map((row, i) => (
            <div key={row.id} className={i > 0 ? "border-t border-black/[.055]" : ""}>
              <PeriodRow row={row} canWrite={canWrite} />
            </div>
          ))}
        </div>
      )}
      {periods.length === 0 && !adding && <p className="m-0 text-[13.5px] text-text-secondary">No accounting periods recorded yet.</p>}

      {canWrite && !adding && (
        <button type="button" onClick={() => setAdding(true)} className={`self-start ${buttonGhost}`}>
          + Add accounting period
        </button>
      )}

      {canWrite && adding && (
        <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={fieldLabel}>Label</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. FY2026" className={input} />
            </div>
            <div>
              <label className={fieldLabel}>Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} />
            </div>
            <div>
              <label className={fieldLabel}>End date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={input} />
            </div>
          </div>
          {status === "error" && <p className="m-0 mt-3 text-[13px] text-red-700">{error}</p>}
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={save} disabled={status === "saving"} className={buttonPrimary}>
              {status === "saving" && <Spinner />}
              {status === "saving" ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setStatus("idle");
                setError("");
              }}
              className={buttonSecondary}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
