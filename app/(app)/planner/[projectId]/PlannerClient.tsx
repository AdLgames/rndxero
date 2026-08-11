"use client";

import { useState } from "react";
import { Panel } from "@/app/components/Panel";
import { buttonPrimary, buttonSecondary, eyebrow, input, select } from "@/app/components/ui";

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

interface Row {
  key: string;
  uncertaintyId: string;
  userId: string;
  weekKey: string;
  hours: string;
}

function hoursLabel(minutes: number): string {
  return (minutes / 60).toFixed(2).replace(/\.?0+$/, "") || "0";
}

function formatMoney(minorUnits: number): string {
  return `£${(minorUnits / 100).toFixed(2)}`;
}

let rowKeySeq = 0;
function newRowKey() {
  rowKeySeq += 1;
  return `row-${rowKeySeq}`;
}

export function PlannerClient({
  companyId,
  projectId,
  canWrite,
  canViewCosts,
  uncertainties,
  members,
  currentPlan,
  plannedCostMinorUnits,
  variance,
  versionHistory,
}: {
  companyId: string;
  projectId: string;
  canWrite: boolean;
  canViewCosts: boolean;
  uncertainties: UncertaintyOption[];
  members: MemberOption[];
  currentPlan: CurrentPlanData | null;
  plannedCostMinorUnits: number | null;
  variance: VarianceRow[];
  versionCount: number;
  versionHistory: VersionHistoryEntry[];
}) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(() =>
    currentPlan
      ? currentPlan.allocations.map((a) => ({
          key: newRowKey(),
          uncertaintyId: a.uncertaintyId,
          userId: a.userId ?? "",
          weekKey: a.weekKey,
          hours: hoursLabel(a.plannedMinutes),
        }))
      : []
  );
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  function addRow() {
    setRows((prev) => [
      ...prev,
      { key: newRowKey(), uncertaintyId: uncertainties[0]?.id ?? "", userId: "", weekKey: "", hours: "" },
    ]);
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  async function submitPlan() {
    setStatus("saving");
    setError("");
    try {
      if (rows.length === 0) throw new Error("Add at least one allocation");
      if (currentPlan && !note.trim()) throw new Error("A note explaining the revision is required");

      const allocations = rows.map((r) => {
        const hours = Number(r.hours);
        if (!r.uncertaintyId) throw new Error("Every row needs an uncertainty");
        if (!/^\d{4}-W\d{2}$/.test(r.weekKey)) throw new Error(`"${r.weekKey}" isn't a valid week key (e.g. 2026-W33)`);
        if (Number.isNaN(hours) || hours <= 0) throw new Error("Every row needs a positive number of hours");
        return {
          uncertaintyId: r.uncertaintyId,
          userId: r.userId || undefined,
          weekKey: r.weekKey,
          plannedMinutes: Math.round(hours * 60),
        };
      });

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

  return (
    <div className="flex flex-col gap-8">
      <Panel className="p-4">
        <p className={eyebrow}>Current plan</p>
        {currentPlan ? (
          <div className="mt-2 text-sm text-foreground/80">
            <p>
              Version {currentPlan.versionNumber} · {hoursLabel(currentPlan.totalPlannedMinutes)}h planned
              {canViewCosts && plannedCostMinorUnits !== null ? ` · ${formatMoney(plannedCostMinorUnits)} derived cost` : ""}
            </p>
            {currentPlan.note && <p className="mt-1 text-foreground/50">&quot;{currentPlan.note}&quot;</p>}
          </div>
        ) : (
          <p className="mt-2 text-sm text-foreground/60">No plan yet.</p>
        )}
      </Panel>

      <section>
        <p className={eyebrow}>Plan vs actual</p>
        {variance.length === 0 ? (
          <p className="mt-2 text-sm text-foreground/60">Nothing planned or logged yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto border border-steel/30">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-steel/30 bg-steel/5 text-xs font-semibold uppercase tracking-wide text-steel-dark">
                  <th className="px-2 py-1.5">Uncertainty</th>
                  <th className="px-2 py-1.5">Week</th>
                  <th className="px-2 py-1.5 text-right">Planned</th>
                  <th className="px-2 py-1.5 text-right">Logged so far</th>
                  <th className="px-2 py-1.5 text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                {variance.map((row, i) => (
                  <tr key={`${row.uncertaintyTitle}-${row.weekKey}-${i}`} className="border-b border-steel/10">
                    <td className="px-2 py-1.5 text-foreground">{row.uncertaintyTitle}</td>
                    <td className="px-2 py-1.5 text-foreground/60">{row.weekKey}</td>
                    <td className="px-2 py-1.5 text-right text-foreground/60">{hoursLabel(row.plannedMinutes)}h</td>
                    <td className="px-2 py-1.5 text-right font-semibold text-sage-dark">{hoursLabel(row.actualMinutes)}h</td>
                    <td className={`px-2 py-1.5 text-right ${row.varianceMinutes < 0 ? "text-red-700" : "text-steel-dark"}`}>
                      {row.varianceMinutes > 0 ? "+" : ""}
                      {hoursLabel(row.varianceMinutes)}h
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-1 text-xs text-foreground/50">
          Actuals only include weeks where someone tagged hours to that specific uncertainty in capture — a blank
          isn&apos;t necessarily zero effort, just untagged.
        </p>
      </section>

      {versionHistory.length > 0 && (
        <section>
          <p className={eyebrow}>Version history</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-foreground/60">
            {versionHistory.map((v) => (
              <li key={v.versionNumber}>
                Version {v.versionNumber} · {hoursLabel(v.totalPlannedMinutes)}h planned ·{" "}
                {v.supersededAt ? "superseded" : "current"}
                {v.note ? ` — "${v.note}"` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {canWrite && (
        <section>
          <p className={eyebrow}>{currentPlan ? "Revise the plan" : "Build a plan"}</p>

          {!builderOpen ? (
            <button type="button" onClick={() => setBuilderOpen(true)} className={`${buttonSecondary} mt-2`}>
              {currentPlan ? "Start a revision" : "Add allocations"}
            </button>
          ) : (
            <div className="mt-2 flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                {rows.map((row) => (
                  <div key={row.key} className="flex flex-wrap items-center gap-2 border border-steel/20 p-2">
                    <select value={row.uncertaintyId} onChange={(e) => updateRow(row.key, { uncertaintyId: e.target.value })} className={select}>
                      {uncertainties.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.title}
                        </option>
                      ))}
                    </select>
                    <select value={row.userId} onChange={(e) => updateRow(row.key, { userId: e.target.value })} className={select}>
                      <option value="">Unassigned</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="2026-W33"
                      value={row.weekKey}
                      onChange={(e) => updateRow(row.key, { weekKey: e.target.value })}
                      className="w-24 border border-steel/40 bg-white px-2 py-1 text-sm text-foreground"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      placeholder="hrs"
                      value={row.hours}
                      onChange={(e) => updateRow(row.key, { hours: e.target.value })}
                      className="w-20 border border-steel/40 bg-white px-2 py-1 text-sm text-foreground"
                    />
                    <button type="button" onClick={() => removeRow(row.key)} className="text-xs font-semibold uppercase text-foreground/50 underline">
                      Remove
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addRow} className="self-start text-xs font-semibold uppercase tracking-wide text-steel-dark underline">
                  + Add row
                </button>
              </div>

              {currentPlan && (
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why is this plan being revised?"
                  rows={2}
                  className={input.replace("mt-1 ", "")}
                />
              )}

              <div>
                <button type="button" disabled={status === "saving"} onClick={submitPlan} className={buttonPrimary}>
                  {status === "saving" ? "Saving…" : currentPlan ? "Save revision" : "Save plan"}
                </button>
                {status === "error" && <p className="mt-1 text-sm text-red-700">{error}</p>}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
