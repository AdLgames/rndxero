"use client";

import { useEffect, useState } from "react";
import type { SubmissionBasis, UncertaintyNoteType } from "@/lib/generated/prisma/client";
import { weekComplianceStatus, type WeekComplianceStatus } from "@/lib/compliance/readiness";
import { SegmentedControl } from "@/app/components/SegmentedControl";
import { Toggle } from "@/app/components/Toggle";
import { ArrowRightIcon, CrosshairIcon, Spinner } from "@/app/components/icons";
import { buttonGhost, buttonPrimary, input } from "@/app/components/ui";

export interface ProjectCaptureData {
  projectId: string;
  projectName: string;
  companyId: string;
  uncertainties: Array<{ id: string; title: string }>;
  prefillMinutes: number | null;
  existing: { minutes: number; basis: SubmissionBasis; locked: boolean } | null;
  commitSignal: { repoFullName: string; count: number } | null;
}

/** A standard working week, used by the "Full week" quick-fill and the equal-split default. */
const STANDARD_WEEK_HOURS = 37.5;

const TAP_OPTIONS: Array<{ label: string; type: UncertaintyNoteType; requiresBody: boolean }> = [
  { label: "No progress", type: "NO_PROGRESS", requiresBody: false },
  { label: "Tried something", type: "ATTEMPT", requiresBody: true },
  { label: "Hit a wall", type: "FAILED_ATTEMPT", requiresBody: true },
  { label: "Solved it", type: "RESOLUTION", requiresBody: true },
];

const STATUS_STYLE: Record<WeekComplianceStatus, { dot: string; label: string }> = {
  green: { dot: "bg-accent", label: "Fully backed" },
  amber: { dot: "bg-[#C88A1E]", label: "Missing narrative or evidence" },
  red: { dot: "bg-[#C0392B]", label: "Unconfirmed — approaching lock" },
};

interface NoteSelection {
  type: UncertaintyNoteType | null;
  body: string;
  /** Optional hours-on-this-uncertainty, as typed (empty = not split out). Feeds the planner's plan-vs-actual view. */
  hours: string;
  /** A commit URL, ticket reference, or other pointer to supporting evidence — manually entered, not a live integration. */
  evidenceRef: string;
}

interface ProjectFormState {
  hours: string;
  /** Whether the visible input is being entered as raw hours or as a % of a standard week — `hours` is always kept as the source of truth for submission. */
  hoursInputMode: "HOURS" | "PERCENT";
  /** Raw percent text, only meaningful while hoursInputMode is "PERCENT" — kept separate so typing "5" doesn't get overwritten by a rounded hours->percent conversion. */
  percent: string;
  nothingThisWeek: boolean;
  basis: SubmissionBasis;
  notes: Record<string, NoteSelection>;
  newUncertaintyOpen: boolean;
  newTitle: string;
  newBaseline: string;
}

function minutesToHoursLabel(minutes: number): string {
  return (minutes / 60).toString();
}

function percentToHoursLabel(percent: string): string {
  const p = Number(percent);
  if (Number.isNaN(p)) return "";
  return (Math.round(((p / 100) * STANDARD_WEEK_HOURS) * 100) / 100).toString();
}

function hoursToPercentLabel(hours: string): string {
  const h = Number(hours);
  if (Number.isNaN(h)) return "";
  return (Math.round((h / STANDARD_WEEK_HOURS) * 100 * 100) / 100).toString();
}

/**
 * A partial week is easy to lose — a wrong-tab close, a laptop lid, a
 * flaky wifi connection mid-form. This is a convenience cache only, keyed
 * per-week in the browser's own storage: it never substitutes for an
 * actual submission, and a real server-side `existing` submission always
 * wins over a stale local draft for that project.
 */
function draftStorageKey(weekKey: string): string {
  return `claimtrail:capture-draft:${weekKey}`;
}

function loadDraft(weekKey: string): Record<string, ProjectFormState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftStorageKey(weekKey));
    if (!raw) return null;
    return (JSON.parse(raw) as { state: Record<string, ProjectFormState> }).state;
  } catch {
    return null;
  }
}

function saveDraft(weekKey: string, state: Record<string, ProjectFormState>): void {
  try {
    window.localStorage.setItem(draftStorageKey(weekKey), JSON.stringify({ savedAt: new Date().toISOString(), state }));
  } catch {
    // Quota exceeded or private-browsing storage disabled — losing the autosave
    // is a minor inconvenience, not data loss, since nothing has been submitted yet.
  }
}

function clearDraft(weekKey: string): void {
  try {
    window.localStorage.removeItem(draftStorageKey(weekKey));
  } catch {
    // ignore
  }
}

export function CaptureClient({
  weekKey,
  projects: initialProjects,
  daysUntilAutoLock,
}: {
  weekKey: string;
  projects: ProjectCaptureData[];
  /** Days remaining before this week auto-locks (close + 7 days) — computed server-side so render stays pure. */
  daysUntilAutoLock: number;
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [state, setState] = useState<Record<string, ProjectFormState>>(() => {
    const draft = loadDraft(weekKey);
    return Object.fromEntries(
      initialProjects.map((p) => {
        // A real submission for this project always wins over a stale local draft.
        if (draft?.[p.projectId] && !p.existing) {
          return [p.projectId, draft[p.projectId]];
        }
        return [
          p.projectId,
          {
            hours: p.existing ? minutesToHoursLabel(p.existing.minutes) : p.prefillMinutes !== null ? minutesToHoursLabel(p.prefillMinutes) : "",
            hoursInputMode: "HOURS",
            percent: "",
            nothingThisWeek: false,
            basis: p.existing?.basis ?? "ESTIMATED",
            notes: {},
            newUncertaintyOpen: false,
            newTitle: "",
            newBaseline: "",
          },
        ];
      })
    );
  });
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [loggedSummary, setLoggedSummary] = useState<Array<{ projectName: string; hours: number }>>([]);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(() => loadDraft(weekKey) !== null ? new Date().toISOString() : null);

  const hasDraftableContent = Object.values(state).some(
    (form) => form.nothingThisWeek || form.hours.trim() !== "" || Object.values(form.notes).some((n) => n.type !== null)
  );

  useEffect(() => {
    if (!hasDraftableContent) return;
    const timeout = setTimeout(() => {
      saveDraft(weekKey, state);
      setDraftSavedAt(new Date().toISOString());
    }, 400);
    return () => clearTimeout(timeout);
  }, [state, weekKey, hasDraftableContent]);

  function updateProject(projectId: string, patch: Partial<ProjectFormState>) {
    setState((prev) => ({ ...prev, [projectId]: { ...prev[projectId], ...patch } }));
  }

  function selectNote(projectId: string, uncertaintyId: string, type: UncertaintyNoteType) {
    setState((prev) => {
      const existingNote = prev[projectId].notes[uncertaintyId] ?? { type: null, body: "", hours: "", evidenceRef: "" };
      return {
        ...prev,
        [projectId]: { ...prev[projectId], notes: { ...prev[projectId].notes, [uncertaintyId]: { ...existingNote, type } } },
      };
    });
  }

  function setNoteBody(projectId: string, uncertaintyId: string, body: string) {
    setState((prev) => {
      const existingNote = prev[projectId].notes[uncertaintyId] ?? { type: null, body: "", hours: "", evidenceRef: "" };
      return {
        ...prev,
        [projectId]: { ...prev[projectId], notes: { ...prev[projectId].notes, [uncertaintyId]: { ...existingNote, body } } },
      };
    });
  }

  function setNoteHours(projectId: string, uncertaintyId: string, hours: string) {
    setState((prev) => {
      const existingNote = prev[projectId].notes[uncertaintyId] ?? { type: null, body: "", hours: "", evidenceRef: "" };
      return {
        ...prev,
        [projectId]: { ...prev[projectId], notes: { ...prev[projectId].notes, [uncertaintyId]: { ...existingNote, hours } } },
      };
    });
  }

  function setNoteEvidenceRef(projectId: string, uncertaintyId: string, evidenceRef: string) {
    setState((prev) => {
      const existingNote = prev[projectId].notes[uncertaintyId] ?? { type: null, body: "", hours: "", evidenceRef: "" };
      return {
        ...prev,
        [projectId]: { ...prev[projectId], notes: { ...prev[projectId].notes, [uncertaintyId]: { ...existingNote, evidenceRef } } },
      };
    });
  }

  /** Divides a standard week evenly across every active, unlocked project that hasn't been touched yet. */
  function equalSplit() {
    const eligible = projects.filter((p) => !(p.existing?.locked ?? false));
    if (eligible.length === 0) return;
    const each = (STANDARD_WEEK_HOURS / eligible.length).toFixed(2).replace(/\.?0+$/, "");
    setState((prev) => {
      const next = { ...prev };
      for (const p of eligible) {
        next[p.projectId] = { ...next[p.projectId], nothingThisWeek: false, hours: each, hoursInputMode: "HOURS", percent: "" };
      }
      return next;
    });
  }

  async function createUncertainty(project: ProjectCaptureData) {
    const form = state[project.projectId];
    if (!form.newTitle.trim() || !form.newBaseline.trim()) return;

    const response = await fetch("/api/capture/uncertainty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: project.companyId,
        projectId: project.projectId,
        title: form.newTitle.trim(),
        baseline: form.newBaseline.trim(),
      }),
    });
    if (!response.ok) return;
    const { uncertainty } = (await response.json()) as { uncertainty: { id: string; title: string } };

    setProjects((prev) =>
      prev.map((p) =>
        p.projectId === project.projectId
          ? { ...p, uncertainties: [...p.uncertainties, { id: uncertainty.id, title: uncertainty.title }] }
          : p
      )
    );
    updateProject(project.projectId, { newUncertaintyOpen: false, newTitle: "", newBaseline: "" });
  }

  async function logThisWeek() {
    setStatus("saving");
    setErrorMessage("");

    const touched = projects.filter((p) => {
      const form = state[p.projectId];
      return form.nothingThisWeek || form.hours.trim() !== "";
    });
    const summary: Array<{ projectName: string; hours: number }> = [];

    try {
      for (const project of touched) {
        const form = state[project.projectId];
        const hours = form.nothingThisWeek ? 0 : Number(form.hours);
        if (Number.isNaN(hours) || hours < 0) {
          throw new Error(`Enter a valid number of hours for ${project.projectName}`);
        }

        const notes = Object.entries(form.notes)
          .filter(([, selection]) => selection.type !== null)
          .map(([uncertaintyId, selection]) => {
            const hours = Number(selection.hours);
            return {
              uncertaintyId,
              type: selection.type as UncertaintyNoteType,
              body: selection.body.trim() || (selection.type === "NO_PROGRESS" ? "No progress this week." : ""),
              minutes: selection.hours.trim() !== "" && !Number.isNaN(hours) && hours > 0 ? Math.round(hours * 60) : undefined,
              evidenceRef: selection.evidenceRef.trim() || undefined,
            };
          });

        const missingBody = notes.find((n) => n.type !== "NO_PROGRESS" && !n.body);
        if (missingBody) {
          throw new Error(`Add a line about what happened on "${project.uncertainties.find((u) => u.id === missingBody.uncertaintyId)?.title}"`);
        }

        const response = await fetch("/api/capture/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: project.companyId,
            projectId: project.projectId,
            weekKey,
            minutes: Math.round(hours * 60),
            basis: form.basis,
            notes,
          }),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `Could not save ${project.projectName}`);
        }
        summary.push({ projectName: project.projectName, hours });
      }
      setLoggedSummary(summary);
      setStatus("done");
      clearDraft(weekKey);
      setDraftSavedAt(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong");
      setStatus("error");
    }
  }

  if (projects.length === 0) {
    return <p className="text-sm text-text-secondary">No projects to log time against yet — ask your project lead to add you.</p>;
  }

  if (status === "done") {
    const totalHours = loggedSummary.reduce((sum, s) => sum + s.hours, 0);
    return (
      <div className="rounded-[16px] border border-black/[.06] bg-accent-wash p-6 text-sm">
        <p className="font-[590] text-accent">
          Week {weekKey} logged — {totalHours}h total.
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-text-secondary">
          {loggedSummary.map((s) => (
            <li key={s.projectName}>
              {s.projectName}: {s.hours}h
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const totalHours = projects.reduce((sum, p) => {
    const form = state[p.projectId];
    if (form.nothingThisWeek) return sum;
    const h = Number(form.hours);
    return sum + (Number.isNaN(h) ? 0 : h);
  }, 0);
  const touchedCount = projects.filter((p) => {
    const form = state[p.projectId];
    return form.nothingThisWeek || form.hours.trim() !== "";
  }).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="flex items-center gap-[6px] text-[12.5px] text-text-tertiary">
          Quick-fill
          {draftSavedAt && (
            <span className="flex items-center gap-[4px] text-text-quaternary">
              <span className="h-[5px] w-[5px] rounded-full bg-accent" aria-hidden />
              Draft saved
            </span>
          )}
        </span>
        <button type="button" onClick={equalSplit} className={buttonGhost}>
          Equal split ({STANDARD_WEEK_HOURS}h across active projects)
        </button>
      </div>

      <div className="flex flex-col gap-[14px]">
        {projects.map((project, i) => {
          const form = state[project.projectId];
          const hoursMode = form.hoursInputMode ?? "HOURS";
          const locked = project.existing?.locked ?? false;
          const primaryUncertainty = project.uncertainties[0];

          const draftNotes = Object.values(form.notes)
            .filter((n) => n.type !== null && n.type !== "NO_PROGRESS")
            .map((n) => ({ body: n.body, evidenceRef: n.evidenceRef }));
          const touched = form.nothingThisWeek || form.hours.trim() !== "";
          const complianceStatus = locked
            ? null
            : touched
              ? weekComplianceStatus({ submitted: true, minutes: form.nothingThisWeek ? 0 : Number(form.hours) || 0, notes: draftNotes })
              : weekComplianceStatus({ submitted: false, daysUntilAutoLock });

          return (
            <div key={project.projectId} className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-6">
              <div className="mb-[22px] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-[10px]">
                  <h4 className="m-0 text-[17px] font-[600] tracking-[-0.02em] text-text">{project.projectName}</h4>
                  {complianceStatus && (
                    <span
                      className="flex items-center gap-[6px] rounded-full bg-control-track px-[10px] py-[3px] text-[11px] font-[500] text-text-secondary"
                      title={STATUS_STYLE[complianceStatus].label}
                    >
                      <span className={`h-[7px] w-[7px] rounded-full ${STATUS_STYLE[complianceStatus].dot}`} />
                      {STATUS_STYLE[complianceStatus].label}
                    </span>
                  )}
                </div>
                {!locked && (
                  <Toggle
                    label="Nothing this week"
                    checked={form.nothingThisWeek}
                    onChange={(checked) =>
                      updateProject(project.projectId, { nothingThisWeek: checked, hours: checked ? "" : form.hours, percent: checked ? "" : form.percent })
                    }
                  />
                )}
              </div>

              {locked ? (
                <p className="text-[13.5px] text-text-secondary">
                  This week is locked ({(project.existing!.minutes / 60).toFixed(1)}h logged). Corrections need an amendment.
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
                      <span className="text-[13.5px] text-text-secondary sm:w-[110px] sm:shrink-0">Hours</span>
                      <div className="flex flex-wrap items-center gap-[10px]">
                        <div className="flex items-center gap-[6px]">
                          <input
                            type="number"
                            min="0"
                            step={hoursMode === "PERCENT" ? "1" : "0.25"}
                            value={hoursMode === "PERCENT" ? form.percent : form.hours}
                            disabled={form.nothingThisWeek}
                            onChange={(e) =>
                              hoursMode === "PERCENT"
                                ? updateProject(project.projectId, { percent: e.target.value, hours: percentToHoursLabel(e.target.value) })
                                : updateProject(project.projectId, { hours: e.target.value })
                            }
                            className="w-[70px] box-border rounded-[10px] border border-black/[.11] bg-white px-3 py-[9px] text-[15px] font-[590] text-text outline-none disabled:opacity-50"
                          />
                          <div className="flex rounded-full bg-control-track p-[2px]" title="Enter time as raw hours or as a % of a standard week">
                            {(["HOURS", "PERCENT"] as const).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                disabled={form.nothingThisWeek}
                                onClick={() =>
                                  updateProject(
                                    project.projectId,
                                    mode === "PERCENT"
                                      ? { hoursInputMode: "PERCENT", percent: hoursToPercentLabel(form.hours) }
                                      : { hoursInputMode: "HOURS" }
                                  )
                                }
                                className={`rounded-full px-[10px] py-[4px] text-[12px] font-[500] transition-all duration-150 disabled:opacity-40 ${
                                  hoursMode === mode ? "bg-white text-text shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-text-tertiary hover:text-text-secondary"
                                }`}
                              >
                                {mode === "HOURS" ? "hrs" : "%"}
                              </button>
                            ))}
                          </div>
                          {hoursMode === "PERCENT" && form.percent.trim() !== "" && (
                            <span className="text-[12.5px] text-text-quaternary">= {form.hours}h</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-[6px]">
                          {project.prefillMinutes !== null && (
                            <button
                              type="button"
                              disabled={form.nothingThisWeek}
                              onClick={() =>
                                updateProject(project.projectId, {
                                  hours: minutesToHoursLabel(project.prefillMinutes!),
                                  hoursInputMode: "HOURS",
                                  percent: "",
                                })
                              }
                              className="rounded-full bg-control-track px-[13px] py-[7px] text-[13px] font-[500] text-text-secondary transition-all duration-150 hover:text-text disabled:opacity-40"
                            >
                              Copy previous week
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={form.nothingThisWeek}
                            onClick={() =>
                              updateProject(project.projectId, { hours: String(STANDARD_WEEK_HOURS), hoursInputMode: "HOURS", percent: "" })
                            }
                            className={`rounded-full px-[13px] py-[7px] text-[13px] transition-all duration-150 disabled:opacity-40 ${
                              form.hours === String(STANDARD_WEEK_HOURS) ? "bg-accent font-[590] text-white" : "bg-control-track font-[500] text-text-secondary hover:text-text"
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
                        value={form.basis}
                        onChange={(value) => updateProject(project.projectId, { basis: value as SubmissionBasis })}
                      />
                    </div>

                    {primaryUncertainty && (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
                        <span className="text-[13.5px] text-text-secondary sm:w-[110px] sm:shrink-0">Challenge</span>
                        <span className="text-[14px] text-text">{primaryUncertainty.title}</span>
                      </div>
                    )}
                  </div>

                  {!form.nothingThisWeek && (
                    <div className="mt-5 flex flex-col gap-3">
                      {project.uncertainties.map((uncertainty) => {
                        const selection = form.notes[uncertainty.id];
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
                                    onClick={() => selectNote(project.projectId, uncertainty.id, option.type)}
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
                                    onChange={(e) => setNoteBody(project.projectId, uncertainty.id, e.target.value)}
                                    className={input}
                                  />
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.25"
                                    placeholder="hrs"
                                    title="Hours spent specifically on this challenge (optional — feeds the plan-vs-actual view)"
                                    value={selection.hours}
                                    onChange={(e) => setNoteHours(project.projectId, uncertainty.id, e.target.value)}
                                    className="w-16 shrink-0 rounded-[10px] border border-black/[.11] bg-white px-[10px] py-[9px] text-[13px] text-text outline-none"
                                  />
                                </div>
                                <input
                                  type="text"
                                  placeholder="Evidence — commit URL, ticket reference, calendar link…"
                                  title="A link or reference a reviewer could follow up on. Optional, but it's what turns a note green."
                                  value={selection.evidenceRef}
                                  onChange={(e) => setNoteEvidenceRef(project.projectId, uncertainty.id, e.target.value)}
                                  className={`${input} text-[13px]`}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {form.newUncertaintyOpen ? (
                        <div className="rounded-[12px] border border-dashed border-black/[.16] p-[14px]">
                          <input
                            type="text"
                            placeholder="What's the challenge?"
                            value={form.newTitle}
                            onChange={(e) => updateProject(project.projectId, { newTitle: e.target.value })}
                            className={input}
                          />
                          <input
                            type="text"
                            placeholder="What didn't we know?"
                            value={form.newBaseline}
                            onChange={(e) => updateProject(project.projectId, { newBaseline: e.target.value })}
                            className={`mt-2 ${input}`}
                          />
                          <button type="button" onClick={() => createUncertainty(project)} className={`${buttonPrimary} mt-2`}>
                            Add
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => updateProject(project.projectId, { newUncertaintyOpen: true })} className={`self-start ${buttonGhost}`}>
                          + Something new came up
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {i === 0 && project.commitSignal && (
                <div className="mt-5 flex items-center gap-2 border-t border-black/[.055] pt-[18px]">
                  <CrosshairIcon className="text-accent" />
                  <span className="text-[13px] text-text-secondary">
                    {project.commitSignal.count} commit{project.commitSignal.count === 1 ? "" : "s"} detected on{" "}
                    <span className="text-text">{project.commitSignal.repoFullName}</span> this week
                  </span>
                  <a href={`/projects/${project.projectId}`} className="ml-auto text-[13px] font-[500]">
                    Review
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-black/[.06] bg-white/90 px-4 py-4 backdrop-blur-[12px] sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
        <span className="text-[14.5px] text-text-secondary">
          Total <span className="font-[590] text-text">{totalHours.toFixed(1)}h</span> across {touchedCount} project{touchedCount === 1 ? "" : "s"}
        </span>
        <button type="button" onClick={logThisWeek} disabled={status === "saving"} className={buttonPrimary}>
          {status === "saving" && <Spinner />}
          {status === "saving" ? "Logging…" : "Log this week"}
          <ArrowRightIcon />
        </button>
      </div>
      {status === "error" && <p className="mt-2 text-sm text-red-700">{errorMessage}</p>}
    </div>
  );
}
