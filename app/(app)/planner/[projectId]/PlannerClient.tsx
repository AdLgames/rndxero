"use client";

import { useState } from "react";
import { buttonPrimary, buttonGhost, fieldLabel, input as inputClass } from "@/app/components/ui";

export interface UncertaintyOption {
  id: string;
  title: string;
}

export interface MemberOption {
  userId: string;
  name: string;
}

export interface CurrentPlanData {
  versionNumber: number;
  note: string | null;
  totalPlannedMinutes: number;
  allocations: Array<{ uncertaintyId: string; userId: string | null; weekKey: string; plannedMinutes: number }>;
}

export interface VarianceRow {
  uncertaintyTitle: string;
  weekKey: string;
  plannedMinutes: number;
  actualMinutes: number;
  varianceMinutes: number;
}

export interface VersionHistoryEntry {
  versionNumber: number;
  note: string | null;
  createdAt: string;
  supersededAt: string | null;
  totalPlannedMinutes: number;
}

function fmtHours(hours: number): string {
  const rounded = Math.round(hours * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2).replace(/0$/, "");
}

function fmtMinutes(minutes: number): string {
  return fmtHours(minutes / 60);
}

function formatMoney(minorUnits: number): string {
  return `£${(minorUnits / 100).toFixed(2)}`;
}

/**
 * The matrix collapses per-allocation user assignment (which the previous
 * row-builder exposed) to a single unassigned figure per uncertainty/week
 * while it's open for editing — the same simplification the design
 * handoff's mockup makes. Saving preserves every allocation for weeks
 * outside this matrix's visible window exactly as they were, including
 * their original assignee, so revising a few weeks never wipes the rest
 * of the plan.
 */
export function PlannerClient({
  companyId,
  projectId,
  canWrite,
  canViewCosts,
  uncertainties,
  currentPlan,
  plannedCostMinorUnits,
  weekKeys,
  currentWeekKey,
  actualMinutesByWeek,
  versionHistory,
}: {
  companyId: string;
  projectId: string;
  canWrite: boolean;
  canViewCosts: boolean;
  uncertainties: UncertaintyOption[];
  currentPlan: CurrentPlanData | null;
  plannedCostMinorUnits: number | null;
  weekKeys: string[];
  currentWeekKey: string;
  actualMinutesByWeek: Record<string, number>;
  versionHistory: VersionHistoryEntry[];
}) {
  const weekKeySet = new Set(weekKeys);

  const [cells, setCells] = useState<Record<string, Record<string, string>>>(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const u of uncertainties) map[u.id] = {};
    for (const a of currentPlan?.allocations ?? []) {
      if (!weekKeySet.has(a.weekKey) || !map[a.uncertaintyId]) continue;
      const perUncertainty = map[a.uncertaintyId];
      const existing = Number(perUncertainty[a.weekKey] ?? "0");
      perUncertainty[a.weekKey] = String(existing + a.plannedMinutes / 60);
    }
    return map;
  });

  const [addingUncertainty, setAddingUncertainty] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBaseline, setNewBaseline] = useState("");
  const [addStatus, setAddStatus] = useState<"idle" | "saving" | "error">("idle");
  const [addError, setAddError] = useState("");

  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  function setCell(uncertaintyId: string, weekKey: string, value: string) {
    setCells((prev) => ({ ...prev, [uncertaintyId]: { ...prev[uncertaintyId], [weekKey]: value } }));
  }

  function rowTotalHours(uncertaintyId: string): number {
    return weekKeys.reduce((sum, wk) => sum + (Number(cells[uncertaintyId]?.[wk]) || 0), 0);
  }

  const grandTotalHours = uncertainties.reduce((sum, u) => sum + rowTotalHours(u.id), 0);

  async function addUncertainty() {
    setAddStatus("saving");
    setAddError("");
    try {
      if (!newTitle.trim() || !newBaseline.trim()) throw new Error("Title and baseline are required");
      const response = await fetch("/api/capture/uncertainty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, projectId, title: newTitle.trim(), baseline: newBaseline.trim() }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not add uncertainty");
      }
      window.location.reload();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "Could not add uncertainty");
      setAddStatus("error");
    }
  }

  async function savePlan() {
    setStatus("saving");
    setError("");
    try {
      if (currentPlan && !note.trim()) throw new Error("A note explaining the revision is required");

      const editedAllocations = uncertainties.flatMap((u) =>
        weekKeys
          .map((weekKey) => ({ weekKey, hours: Number(cells[u.id]?.[weekKey]) || 0 }))
          .filter((a) => a.hours > 0)
          .map((a) => ({ uncertaintyId: u.id, weekKey: a.weekKey, plannedMinutes: Math.round(a.hours * 60) }))
      );
      const untouchedAllocations = (currentPlan?.allocations ?? [])
        .filter((a) => !weekKeySet.has(a.weekKey))
        .map((a) => ({ uncertaintyId: a.uncertaintyId, userId: a.userId ?? undefined, weekKey: a.weekKey, plannedMinutes: a.plannedMinutes }));

      const allocations = [...untouchedAllocations, ...editedAllocations];
      if (allocations.length === 0) throw new Error("Add at least one planned hour");

      const response = await fetch("/api/plan/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, projectId, note: note.trim() || undefined, allocations }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not save plan");
      }
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save plan");
      setStatus("error");
    }
  }

  // minmax(200px,1fr) rather than a bare 1fr: on the narrow end of the horizontal-scroll
  // container below, a bare 1fr shrinks the uncertainty title column to whatever's left over
  // (well under 100px), wrapping real titles into a dozen one-word lines instead of two or three.
  const gridColumns = `minmax(200px,1fr) repeat(${weekKeys.length}, 86px) 96px`;

  return (
    <div className="flex flex-col gap-6">
      {(currentPlan || (canViewCosts && plannedCostMinorUnits !== null)) && (
        <p className="m-0 text-[13px] text-text-tertiary">
          {currentPlan ? `Version ${currentPlan.versionNumber} · ${fmtMinutes(currentPlan.totalPlannedMinutes)}h planned` : "No plan yet"}
          {canViewCosts && plannedCostMinorUnits !== null ? ` · ${formatMoney(plannedCostMinorUnits)} derived cost` : ""}
          {currentPlan?.note ? ` — "${currentPlan.note}"` : ""}
        </p>
      )}

      {uncertainties.length === 0 ? (
        <p className="text-[14px] text-text-secondary">No uncertainties yet — add one below to start planning.</p>
      ) : (
        <div className="overflow-x-auto rounded-[16px] border border-black/[.06]">
          <div className="min-w-[740px]">
            <div className="grid items-center bg-surface-header px-[22px] py-[13px] text-[12.5px] text-text-tertiary" style={{ gridTemplateColumns: gridColumns }}>
              <span>Uncertainty</span>
              {weekKeys.map((wk) => (
                <span key={wk} className="text-center">
                  {wk.slice(6)}
                </span>
              ))}
              <span className="text-right">Planned</span>
            </div>

            {uncertainties.map((uncertainty) => (
              <div
                key={uncertainty.id}
                className="grid items-center border-t border-black/[.05] px-[22px] py-[14px]"
                style={{ gridTemplateColumns: gridColumns }}
              >
                <span className="pr-5 text-[14px] leading-[1.4] text-text">{uncertainty.title}</span>
                {weekKeys.map((wk) => (
                  <span key={wk} className="flex justify-center">
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      disabled={!canWrite}
                      value={cells[uncertainty.id]?.[wk] ?? ""}
                      onChange={(e) => setCell(uncertainty.id, wk, e.target.value)}
                      className="w-[46px] rounded-[8px] border border-black/[.11] bg-white px-1 py-[8px] text-center text-[13.5px] text-text outline-none transition-colors duration-150 focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_rgba(14,122,88,.15)] disabled:bg-control-track disabled:text-text-quaternary"
                    />
                  </span>
                ))}
                <span className="text-right text-[16px] font-[600] tracking-[-0.02em] text-text">{fmtHours(rowTotalHours(uncertainty.id))}h</span>
              </div>
            ))}

            <div className="grid items-center bg-accent-wash px-[22px] py-[15px]" style={{ gridTemplateColumns: gridColumns }}>
              <span className="text-[14px] font-[590] text-text">Logged so far</span>
              {weekKeys.map((wk) => {
                const isPast = wk <= currentWeekKey;
                return (
                  <span key={wk} className={`text-center text-[13.5px] font-[590] ${isPast ? "text-accent" : "text-text-disabled"}`}>
                    {isPast ? fmtMinutes(actualMinutesByWeek[wk] ?? 0) : "—"}
                  </span>
                );
              })}
              <span className="text-right text-[16px] font-[600] tracking-[-0.02em] text-accent">
                {fmtMinutes(weekKeys.filter((wk) => wk <= currentWeekKey).reduce((sum, wk) => sum + (actualMinutesByWeek[wk] ?? 0), 0))}h
              </span>
            </div>
          </div>
        </div>
      )}

      {canWrite && (
        <div>
          {!addingUncertainty ? (
            <button type="button" onClick={() => setAddingUncertainty(true)} className={buttonGhost}>
              + Add uncertainty
            </button>
          ) : (
            <div className="flex flex-col gap-3 rounded-[14px] border border-black/[.06] bg-surface-sunken p-4">
              <label className="block">
                <span className={fieldLabel}>Title</span>
                <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="What's uncertain" className={inputClass} />
              </label>
              <label className="block">
                <span className={fieldLabel}>Baseline</span>
                <input
                  type="text"
                  value={newBaseline}
                  onChange={(e) => setNewBaseline(e.target.value)}
                  placeholder="What existing knowledge/practice doesn't already solve this"
                  className={inputClass}
                />
              </label>
              <div className="flex items-center gap-3">
                <button type="button" disabled={addStatus === "saving"} onClick={addUncertainty} className={buttonPrimary}>
                  {addStatus === "saving" ? "Adding…" : "Add"}
                </button>
                <button type="button" onClick={() => setAddingUncertainty(false)} className={buttonGhost}>
                  Cancel
                </button>
              </div>
              {addStatus === "error" && <p className="m-0 text-[13px] text-red-700">{addError}</p>}
            </div>
          )}
        </div>
      )}

      {canWrite && uncertainties.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-black/[.06] pt-5">
          {currentPlan && (
            <label className="block max-w-[440px]">
              <span className={fieldLabel}>Why is this plan being revised?</span>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Required for a revision" className={inputClass} />
            </label>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[14.5px] text-text-secondary">
              Total planned <span className="font-[590] text-text">{fmtHours(grandTotalHours)}h</span>
            </span>
            <button type="button" disabled={status === "saving"} onClick={savePlan} className={buttonPrimary}>
              {status === "saving" ? "Saving…" : currentPlan ? "Save revision" : "Save plan"}
            </button>
          </div>
          {status === "error" && <p className="m-0 text-[13px] text-red-700">{error}</p>}
        </div>
      )}

      {versionHistory.length > 1 && (
        <div className="border-t border-black/[.06] pt-5">
          <p className="m-0 mb-2 text-[12.5px] text-text-tertiary">Version history</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-text-secondary">
            {versionHistory.map((v) => (
              <li key={v.versionNumber}>
                Version {v.versionNumber} · {fmtMinutes(v.totalPlannedMinutes)}h planned · {v.supersededAt ? "superseded" : "current"}
                {v.note ? ` — "${v.note}"` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
