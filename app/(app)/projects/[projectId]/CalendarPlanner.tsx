"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { ProjectRole } from "@/lib/generated/prisma/client";
import { SegmentedControl } from "@/app/components/SegmentedControl";
import { badgeAccent, badgeNeutral, buttonGhost, buttonPrimary, input } from "@/app/components/ui";
import { Spinner, XIcon } from "@/app/components/icons";

const ROLE_LABEL: Record<ProjectRole, string> = { LEAD: "Owner", CONTRIBUTOR: "Contributor", ADVISER: "Adviser" };

export interface CalendarMember {
  userId: string;
  name: string;
  role: ProjectRole;
}

export interface CalendarChallenge {
  id: string;
  title: string;
}

export interface CalendarAllocation {
  userId: string | null;
  uncertaintyId: string;
  weekKey: string;
  plannedMinutes: number;
}

export interface CalendarActual {
  userId: string;
  weekKey: string;
  minutes: number;
}

export interface CalendarVersionHistoryEntry {
  versionNumber: number;
  note: string | null;
  supersededAt: string | null;
  totalPlannedMinutes: number;
}

export interface CalendarPlannerProps {
  companyId: string;
  projectId: string;
  canWrite: boolean;
  members: CalendarMember[];
  challenges: CalendarChallenge[];
  weekKeys: string[];
  currentWeekKey: string;
  hasExistingPlan: boolean;
  allocations: CalendarAllocation[];
  actuals: CalendarActual[];
  versionHistory: CalendarVersionHistoryEntry[];
}

const UNASSIGNED_KEY = "__unassigned__";
const DENSITY_WIDTH = { compact: 40, comfortable: 60 } as const;
type Density = keyof typeof DENSITY_WIDTH;

// draft[rowKey][weekKey][uncertaintyId] = hours (as typed)
type Draft = Record<string, Record<string, Record<string, string>>>;

function fmtHours(minutes: number): string {
  const hours = minutes / 60;
  const rounded = Math.round(hours * 100) / 100;
  return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2).replace(/0$/, "");
}

function cellTotalMinutes(draft: Draft, rowKey: string, weekKey: string): number {
  const perChallenge = draft[rowKey]?.[weekKey] ?? {};
  return Object.values(perChallenge).reduce((sum, v) => sum + (Number(v) || 0) * 60, 0);
}

function varianceClass(planned: number, actual: number): string {
  if (planned === 0 && actual === 0) return "text-text-quaternary";
  if (actual === 0) return "text-text-quaternary";
  const ratio = actual / Math.max(planned, 1);
  if (ratio >= 0.85 && ratio <= 1.15) return "text-accent";
  return "text-[#C0392B]";
}

/**
 * Rows are people (name + project role), columns are weeks — the same
 * PlannedAllocation data the old challenge-rows matrix used, just pivoted
 * by userId instead of uncertaintyId. A cell can span several challenges
 * for one person/week, so clicking it opens a small popover with one
 * input per open challenge rather than editing a single number in place.
 * Edits are local (`draft`) until "Save revision" — matching the plan
 * model's versioning (a full new PlanVersion, not per-cell writes), same
 * as the matrix this replaces, just avoided per keystroke instead of
 * per-cell to keep the version history from spamming.
 */
export function CalendarPlanner({ companyId, projectId, canWrite, members, challenges, weekKeys, currentWeekKey, hasExistingPlan, allocations, actuals, versionHistory }: CalendarPlannerProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);

  const rows = [
    ...members.map((m) => ({ key: m.userId, name: m.name, role: m.role as ProjectRole | null })),
    ...(allocations.some((a) => a.userId === null) ? [{ key: UNASSIGNED_KEY, name: "Unassigned", role: null }] : []),
  ];

  const [draft, setDraft] = useState<Draft>(() => {
    const next: Draft = {};
    for (const a of allocations) {
      const rowKey = a.userId ?? UNASSIGNED_KEY;
      next[rowKey] ??= {};
      next[rowKey][a.weekKey] ??= {};
      next[rowKey][a.weekKey][a.uncertaintyId] = fmtHours(a.plannedMinutes);
    }
    return next;
  });

  const actualByRowWeek = new Map<string, number>();
  for (const a of actuals) {
    actualByRowWeek.set(`${a.userId}:${a.weekKey}`, (actualByRowWeek.get(`${a.userId}:${a.weekKey}`) ?? 0) + a.minutes);
  }

  const [density, setDensity] = useState<Density>("comfortable");
  const [openCell, setOpenCell] = useState<{ rowKey: string; rowName: string; weekKey: string } | null>(null);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const currentIndex = weekKeys.indexOf(currentWeekKey);
    if (currentIndex > 0 && scrollRef.current) {
      const colWidth = DENSITY_WIDTH[density];
      scrollRef.current.scrollLeft = Math.max(0, currentIndex * colWidth - colWidth * 2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setCellValue(rowKey: string, weekKey: string, uncertaintyId: string, hours: string) {
    setDraft((prev) => ({
      ...prev,
      [rowKey]: { ...prev[rowKey], [weekKey]: { ...prev[rowKey]?.[weekKey], [uncertaintyId]: hours } },
    }));
  }

  async function saveRevision() {
    setStatus("saving");
    setError("");
    try {
      if (hasExistingPlan && !note.trim()) throw new Error("A note explaining the revision is required");

      const allocationInputs: Array<{ uncertaintyId: string; userId?: string; weekKey: string; plannedMinutes: number }> = [];
      for (const [rowKey, byWeek] of Object.entries(draft)) {
        for (const [weekKey, byChallenge] of Object.entries(byWeek)) {
          for (const [uncertaintyId, hoursStr] of Object.entries(byChallenge)) {
            const hours = Number(hoursStr);
            if (!hoursStr || Number.isNaN(hours) || hours <= 0) continue;
            allocationInputs.push({
              uncertaintyId,
              userId: rowKey === UNASSIGNED_KEY ? undefined : rowKey,
              weekKey,
              plannedMinutes: Math.round(hours * 60),
            });
          }
        }
      }
      if (allocationInputs.length === 0) throw new Error("Add at least one planned hour");

      const response = await fetch("/api/plan/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, projectId, note: note.trim() || undefined, allocations: allocationInputs }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not save plan");
      }
      router.refresh();
      setStatus("idle");
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save plan");
      setStatus("error");
    }
  }

  const colWidth = DENSITY_WIDTH[density];

  if (rows.length === 0) {
    return <p className="text-[14px] text-text-secondary">No one is assigned to this project yet — add contributors above to start planning.</p>;
  }
  if (challenges.length === 0) {
    return <p className="text-[14px] text-text-secondary">No open challenges yet — raise one before planning hours against it.</p>;
  }

  return (
    <div className="rounded-[16px] border border-black/[.06]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[.06] px-5 py-3">
        <div className="flex items-center gap-[10px]">
          <span className="text-[12px] text-text-tertiary">Visibility</span>
          <SegmentedControl
            options={[
              { value: "compact", label: "Compact" },
              { value: "comfortable", label: "Comfortable" },
            ]}
            value={density}
            onChange={(v) => setDensity(v as Density)}
          />
        </div>
        <div className="flex items-center gap-[14px] text-[11.5px] text-text-tertiary">
          <span className="flex items-center gap-[5px]">
            <span className="h-[7px] w-[7px] rounded-full bg-accent" /> On track
          </span>
          <span className="flex items-center gap-[5px]">
            <span className="h-[7px] w-[7px] rounded-full bg-[#C0392B]" /> Off plan
          </span>
        </div>
      </div>

      <div ref={scrollRef} className="overflow-auto" style={{ maxHeight: 420 }}>
        <div className="inline-block min-w-full">
          <div className="sticky top-0 z-20 flex bg-white">
            <div className="sticky left-0 z-30 w-[170px] shrink-0 border-b border-r border-black/[.06] bg-white px-3 py-2 text-[11px] font-[590] text-text-tertiary">Person</div>
            {weekKeys.map((wk) => (
              <div
                key={wk}
                className={`shrink-0 border-b border-black/[.06] py-2 text-center text-[10.5px] ${wk === currentWeekKey ? "bg-accent-wash font-[590] text-accent" : "text-text-quaternary"}`}
                style={{ width: colWidth }}
              >
                {wk.slice(6)}
              </div>
            ))}
          </div>

          {rows.map((row) => (
            <div key={row.key} className="flex">
              <div className="sticky left-0 z-10 flex w-[170px] shrink-0 flex-col justify-center gap-[3px] border-b border-r border-black/[.06] bg-white px-3 py-2">
                <span className="truncate text-[12.5px] font-[600] text-text">{row.name}</span>
                {row.role && <span className={row.role === "LEAD" ? badgeAccent : badgeNeutral}>{ROLE_LABEL[row.role]}</span>}
              </div>
              {weekKeys.map((wk) => {
                const plannedMinutes = cellTotalMinutes(draft, row.key, wk);
                const actualMinutes = row.key === UNASSIGNED_KEY ? 0 : (actualByRowWeek.get(`${row.key}:${wk}`) ?? 0);
                const hasContent = plannedMinutes > 0 || actualMinutes > 0;
                return (
                  <button
                    key={wk}
                    type="button"
                    disabled={!canWrite}
                    onClick={() => setOpenCell({ rowKey: row.key, rowName: row.name, weekKey: wk })}
                    className={`flex shrink-0 flex-col items-center justify-center gap-[2px] border-b border-black/[.045] py-2 transition-colors duration-150 ${
                      canWrite ? "cursor-pointer hover:bg-control-track" : "cursor-default"
                    } ${wk === currentWeekKey ? "bg-accent-wash/40" : ""}`}
                    style={{ width: colWidth }}
                  >
                    {hasContent ? (
                      <>
                        <span className="text-[11.5px] font-[590] text-text">{fmtHours(plannedMinutes)}</span>
                        <span className={`text-[10px] ${varianceClass(plannedMinutes, actualMinutes)}`}>{fmtHours(actualMinutes)}</span>
                      </>
                    ) : (
                      <span className="text-[11px] text-text-disabled">—</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {canWrite && (
        <div className="flex flex-col gap-3 border-t border-black/[.06] p-5">
          {hasExistingPlan && (
            <label className="block max-w-[440px]">
              <span className="mb-[6px] block text-[12.5px] text-text-secondary">Why is this plan being revised?</span>
              <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Required for a revision" className={input} />
            </label>
          )}
          <div className="flex items-center gap-3">
            <button type="button" disabled={status === "saving"} onClick={saveRevision} className={buttonPrimary}>
              {status === "saving" && <Spinner />}
              {status === "saving" ? "Saving…" : "Save revision"}
            </button>
            {status === "error" && <span className="text-[13px] text-red-700">{error}</span>}
          </div>
        </div>
      )}

      {versionHistory.length > 1 && (
        <div className="border-t border-black/[.06] p-5">
          <p className="m-0 mb-2 text-[12.5px] text-text-tertiary">Version history</p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-text-secondary">
            {versionHistory.map((v) => (
              <li key={v.versionNumber}>
                Version {v.versionNumber} · {fmtHours(v.totalPlannedMinutes)}h planned · {v.supersededAt ? "superseded" : "current"}
                {v.note ? ` — "${v.note}"` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {openCell &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/[.28] p-4 backdrop-blur-[2px]" onClick={() => setOpenCell(null)}>
            <div className="w-full max-w-[380px] rounded-[16px] bg-white p-6 shadow-[0_16px_48px_rgba(0,0,0,.18)]" onClick={(e) => e.stopPropagation()}>
              <div className="mb-1 flex items-center justify-between">
                <h5 className="m-0 text-[15px] font-[640] tracking-[-0.02em] text-text">
                  {openCell.rowName} · {openCell.weekKey}
                </h5>
                <button type="button" onClick={() => setOpenCell(null)} aria-label="Close" className="text-text-tertiary hover:text-text">
                  <XIcon />
                </button>
              </div>
              {openCell.rowKey !== UNASSIGNED_KEY && (
                <p className="m-0 mb-4 text-[12.5px] text-text-quaternary">
                  Logged so far this week: {fmtHours(actualByRowWeek.get(`${openCell.rowKey}:${openCell.weekKey}`) ?? 0)}h
                </p>
              )}

              <div className="flex flex-col gap-3">
                {challenges.map((c) => (
                  <label key={c.id} className="flex items-center justify-between gap-3">
                    <span className="text-[13px] text-text">{c.title}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={draft[openCell.rowKey]?.[openCell.weekKey]?.[c.id] ?? ""}
                      onChange={(e) => setCellValue(openCell.rowKey, openCell.weekKey, c.id, e.target.value)}
                      placeholder="0"
                      className="w-[70px] shrink-0 rounded-[8px] border border-black/[.11] bg-white px-2 py-[7px] text-center text-[13px] text-text outline-none"
                    />
                  </label>
                ))}
              </div>

              <button type="button" onClick={() => setOpenCell(null)} className={`${buttonGhost} mt-5`}>
                Done
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
