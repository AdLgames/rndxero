"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SubmissionBasis, UncertaintyNoteType } from "@/lib/generated/prisma/client";
import { SegmentedControl } from "@/app/components/SegmentedControl";
import { Toggle } from "@/app/components/Toggle";
import { ArrowRightIcon } from "@/app/components/icons";
import { buttonGhost, buttonPrimary, eyebrow, input } from "@/app/components/ui";

export interface WeekLogUncertainty {
  id: string;
  title: string;
}

export interface WeekLogData {
  projectId: string;
  companyId: string;
  weekKey: string;
  /** Days remaining before this week auto-locks (close + 7 days) — computed server-side so render stays pure. */
  daysUntilAutoLock: number;
  uncertainties: WeekLogUncertainty[];
  prefillMinutes: number | null;
  existing: { minutes: number; basis: SubmissionBasis; locked: boolean } | null;
}

const STANDARD_WEEK_HOURS = 37.5;

const TAP_OPTIONS: Array<{ label: string; type: UncertaintyNoteType }> = [
  { label: "No progress", type: "NO_PROGRESS" },
  { label: "Tried something", type: "ATTEMPT" },
  { label: "Hit a wall", type: "FAILED_ATTEMPT" },
  { label: "Solved it", type: "RESOLUTION" },
];

interface NoteSelection {
  type: UncertaintyNoteType | null;
  body: string;
  hours: string;
  evidenceRef: string;
}

function minutesToHoursLabel(minutes: number): string {
  return (minutes / 60).toString();
}

/**
 * "Add time + notes" for one project, inline on its detail page — the
 * project-scoped counterpart to CaptureClient's per-project card. Kept
 * as its own component rather than extracted out of CaptureClient: that
 * component's multi-project state (equal-split quick-fill, one combined
 * submit, a shared sticky total) is wired around managing several
 * projects' form state from one parent, which doesn't fit a single-
 * project card without either lifting a lot of that back out or forcing
 * an awkward shared abstraction onto a live, tested flow. Some overlap
 * with CaptureClient's markup is the accepted cost of that.
 */
export function ProjectWeekLogCard({ data }: { data: WeekLogData }) {
  const router = useRouter();
  const locked = data.existing?.locked ?? false;

  const [uncertainties, setUncertainties] = useState(data.uncertainties);
  const [hours, setHours] = useState(
    data.existing ? minutesToHoursLabel(data.existing.minutes) : data.prefillMinutes !== null ? minutesToHoursLabel(data.prefillMinutes) : ""
  );
  const [nothingThisWeek, setNothingThisWeek] = useState(false);
  const [basis, setBasis] = useState<SubmissionBasis>(data.existing?.basis ?? "ESTIMATED");
  const [notes, setNotes] = useState<Record<string, NoteSelection>>({});
  const [newUncertaintyOpen, setNewUncertaintyOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBaseline, setNewBaseline] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");

  function patchNote(uncertaintyId: string, patch: Partial<NoteSelection>) {
    setNotes((prev) => ({
      ...prev,
      [uncertaintyId]: { ...(prev[uncertaintyId] ?? { type: null, body: "", hours: "", evidenceRef: "" }), ...patch },
    }));
  }

  async function createUncertainty() {
    if (!newTitle.trim() || !newBaseline.trim()) return;
    const response = await fetch("/api/capture/uncertainty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: data.companyId, projectId: data.projectId, title: newTitle.trim(), baseline: newBaseline.trim() }),
    });
    if (!response.ok) return;
    const { uncertainty } = (await response.json()) as { uncertainty: { id: string; title: string } };
    setUncertainties((prev) => [...prev, { id: uncertainty.id, title: uncertainty.title }]);
    setNewUncertaintyOpen(false);
    setNewTitle("");
    setNewBaseline("");
  }

  async function logThisWeek() {
    setStatus("saving");
    setError("");
    try {
      const hoursValue = nothingThisWeek ? 0 : Number(hours);
      if (Number.isNaN(hoursValue) || hoursValue < 0) {
        throw new Error("Enter a valid number of hours");
      }

      const noteInputs = Object.entries(notes)
        .filter(([, selection]) => selection.type !== null)
        .map(([uncertaintyId, selection]) => {
          const noteHours = Number(selection.hours);
          return {
            uncertaintyId,
            type: selection.type as UncertaintyNoteType,
            body: selection.body.trim() || (selection.type === "NO_PROGRESS" ? "No progress this week." : ""),
            minutes: selection.hours.trim() !== "" && !Number.isNaN(noteHours) && noteHours > 0 ? Math.round(noteHours * 60) : undefined,
            evidenceRef: selection.evidenceRef.trim() || undefined,
          };
        });

      const missingBody = noteInputs.find((n) => n.type !== "NO_PROGRESS" && !n.body);
      if (missingBody) {
        throw new Error(`Add a line about what happened on "${uncertainties.find((u) => u.id === missingBody.uncertaintyId)?.title}"`);
      }

      const response = await fetch("/api/capture/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: data.companyId,
          projectId: data.projectId,
          weekKey: data.weekKey,
          minutes: Math.round(hoursValue * 60),
          basis,
          notes: noteInputs,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not save this week");
      }

      setStatus("done");
      setNotes({});
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-6">
      <div className="mb-[18px] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className={eyebrow}>
          Log time &amp; notes — <span className="font-[590] text-text-secondary">{data.weekKey}</span>
        </p>
        {!locked && (
          <Toggle label="Nothing this week" checked={nothingThisWeek} onChange={(checked) => { setNothingThisWeek(checked); if (checked) setHours(""); }} />
        )}
      </div>

      {locked ? (
        <p className="text-[13.5px] text-text-secondary">
          This week is locked ({(data.existing!.minutes / 60).toFixed(1)}h logged). Corrections need an amendment from Finance.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
              <span className="text-[13.5px] text-text-secondary sm:w-[110px] sm:shrink-0">Hours</span>
              <div className="flex flex-wrap items-center gap-[10px]">
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={hours}
                  disabled={nothingThisWeek}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-[70px] box-border rounded-[10px] border border-black/[.11] bg-white px-3 py-[9px] text-[15px] font-[590] text-text outline-none disabled:opacity-50"
                />
                <div className="flex flex-wrap gap-[6px]">
                  {data.prefillMinutes !== null && (
                    <button
                      type="button"
                      disabled={nothingThisWeek}
                      onClick={() => setHours(minutesToHoursLabel(data.prefillMinutes!))}
                      className="rounded-full bg-control-track px-[13px] py-[7px] text-[13px] font-[500] text-text-secondary transition-all duration-150 hover:text-text disabled:opacity-40"
                    >
                      Copy previous week
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={nothingThisWeek}
                    onClick={() => setHours(String(STANDARD_WEEK_HOURS))}
                    className={`rounded-full px-[13px] py-[7px] text-[13px] transition-all duration-150 disabled:opacity-40 ${
                      hours === String(STANDARD_WEEK_HOURS) ? "bg-accent font-[590] text-white" : "bg-control-track font-[500] text-text-secondary hover:text-text"
                    }`}
                  >
                    Full week ({STANDARD_WEEK_HOURS}h)
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
              <span className="text-[13.5px] text-text-secondary sm:w-[110px] sm:shrink-0">Basis</span>
              <SegmentedControl
                segmentClassName="px-4 py-[7px]"
                options={[
                  { value: "ESTIMATED", label: "Estimated" },
                  { value: "TRACKED", label: "From timesheet" },
                ]}
                value={basis}
                onChange={(value) => setBasis(value as SubmissionBasis)}
              />
            </div>
          </div>

          {!nothingThisWeek && (
            <div className="mt-5 flex flex-col gap-3">
              {uncertainties.map((uncertainty) => {
                const selection = notes[uncertainty.id];
                return (
                  <div key={uncertainty.id} className="rounded-[12px] border border-black/[.055] p-[14px]">
                    <p className="m-0 text-[13.5px] font-[600] text-text">{uncertainty.title}</p>
                    <div className="mt-2 flex flex-wrap gap-[6px]">
                      {TAP_OPTIONS.map((option) => {
                        const active = selection?.type === option.type;
                        return (
                          <button
                            key={option.type}
                            type="button"
                            onClick={() => patchNote(uncertainty.id, { type: option.type })}
                            className={`rounded-full px-[13px] py-[7px] text-[13px] transition-all duration-150 ${
                              active ? "bg-accent font-[590] text-white" : "bg-control-track font-[500] text-text-secondary hover:text-text"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    {selection?.type && selection.type !== "NO_PROGRESS" && (
                      <div className="mt-2 flex flex-col gap-[6px]">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="One line about what happened"
                            value={selection.body}
                            onChange={(e) => patchNote(uncertainty.id, { body: e.target.value })}
                            className={input}
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            placeholder="hrs"
                            title="Hours spent specifically on this uncertainty (optional — feeds the plan-vs-actual chart)"
                            value={selection.hours}
                            onChange={(e) => patchNote(uncertainty.id, { hours: e.target.value })}
                            className="w-16 shrink-0 rounded-[10px] border border-black/[.11] bg-white px-[10px] py-[9px] text-[13px] text-text outline-none"
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Evidence — commit URL, ticket reference, calendar link…"
                          title="A link or reference a reviewer could follow up on. Optional, but it's what turns a note green."
                          value={selection.evidenceRef}
                          onChange={(e) => patchNote(uncertainty.id, { evidenceRef: e.target.value })}
                          className={`${input} text-[13px]`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {newUncertaintyOpen ? (
                <div className="rounded-[12px] border border-dashed border-black/[.16] p-[14px]">
                  <input type="text" placeholder="What's the uncertainty?" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className={input} />
                  <input
                    type="text"
                    placeholder="What didn't we know?"
                    value={newBaseline}
                    onChange={(e) => setNewBaseline(e.target.value)}
                    className={`mt-2 ${input}`}
                  />
                  <button type="button" onClick={createUncertainty} className={`${buttonPrimary} mt-2`}>
                    Add
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setNewUncertaintyOpen(true)} className={`self-start ${buttonGhost}`}>
                  + Something new came up
                </button>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-black/[.055] pt-5">
            <button type="button" onClick={logThisWeek} disabled={status === "saving"} className={buttonPrimary}>
              {status === "saving" ? "Saving…" : "Save this week"}
              <ArrowRightIcon />
            </button>
            {status === "done" && <span className="text-[13.5px] font-[590] text-accent">Saved.</span>}
            {status === "error" && <span className="text-[13.5px] text-red-700">{error}</span>}
          </div>
        </>
      )}
    </div>
  );
}
