"use client";

import { useState } from "react";
import type { SubmissionBasis, UncertaintyNoteType } from "@/lib/generated/prisma/client";
import { SegmentedControl } from "@/app/components/SegmentedControl";
import { Toggle } from "@/app/components/Toggle";
import { ArrowRightIcon, CrosshairIcon } from "@/app/components/icons";
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

const QUICK_CHIP_HOURS = [5, 10, 20, 40];

const TAP_OPTIONS: Array<{ label: string; type: UncertaintyNoteType; requiresBody: boolean }> = [
  { label: "No progress", type: "NO_PROGRESS", requiresBody: false },
  { label: "Tried something", type: "ATTEMPT", requiresBody: true },
  { label: "Hit a wall", type: "FAILED_ATTEMPT", requiresBody: true },
  { label: "Solved it", type: "RESOLUTION", requiresBody: true },
];

interface NoteSelection {
  type: UncertaintyNoteType | null;
  body: string;
  /** Optional hours-on-this-uncertainty, as typed (empty = not split out). Feeds the planner's plan-vs-actual view. */
  hours: string;
}

interface ProjectFormState {
  hours: string;
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

export function CaptureClient({ weekKey, projects: initialProjects }: { weekKey: string; projects: ProjectCaptureData[] }) {
  const [projects, setProjects] = useState(initialProjects);
  const [state, setState] = useState<Record<string, ProjectFormState>>(() =>
    Object.fromEntries(
      initialProjects.map((p) => [
        p.projectId,
        {
          hours: p.existing ? minutesToHoursLabel(p.existing.minutes) : p.prefillMinutes !== null ? minutesToHoursLabel(p.prefillMinutes) : "",
          nothingThisWeek: false,
          basis: p.existing?.basis ?? "ESTIMATED",
          notes: {},
          newUncertaintyOpen: false,
          newTitle: "",
          newBaseline: "",
        },
      ])
    )
  );
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [loggedSummary, setLoggedSummary] = useState<Array<{ projectName: string; hours: number }>>([]);

  function updateProject(projectId: string, patch: Partial<ProjectFormState>) {
    setState((prev) => ({ ...prev, [projectId]: { ...prev[projectId], ...patch } }));
  }

  function selectNote(projectId: string, uncertaintyId: string, type: UncertaintyNoteType) {
    setState((prev) => {
      const existingNote = prev[projectId].notes[uncertaintyId] ?? { type: null, body: "", hours: "" };
      return {
        ...prev,
        [projectId]: { ...prev[projectId], notes: { ...prev[projectId].notes, [uncertaintyId]: { ...existingNote, type } } },
      };
    });
  }

  function setNoteBody(projectId: string, uncertaintyId: string, body: string) {
    setState((prev) => {
      const existingNote = prev[projectId].notes[uncertaintyId] ?? { type: null, body: "", hours: "" };
      return {
        ...prev,
        [projectId]: { ...prev[projectId], notes: { ...prev[projectId].notes, [uncertaintyId]: { ...existingNote, body } } },
      };
    });
  }

  function setNoteHours(projectId: string, uncertaintyId: string, hours: string) {
    setState((prev) => {
      const existingNote = prev[projectId].notes[uncertaintyId] ?? { type: null, body: "", hours: "" };
      return {
        ...prev,
        [projectId]: { ...prev[projectId], notes: { ...prev[projectId].notes, [uncertaintyId]: { ...existingNote, hours } } },
      };
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
      <div className="flex flex-col gap-[14px]">
        {projects.map((project, i) => {
          const form = state[project.projectId];
          const locked = project.existing?.locked ?? false;
          const primaryUncertainty = project.uncertainties[0];
          return (
            <div key={project.projectId} className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-6">
              <div className="mb-[22px] flex items-center justify-between">
                <h4 className="m-0 text-[17px] font-[600] tracking-[-0.02em] text-text">{project.projectName}</h4>
                {!locked && (
                  <Toggle
                    label="Nothing this week"
                    checked={form.nothingThisWeek}
                    onChange={(checked) => updateProject(project.projectId, { nothingThisWeek: checked, hours: checked ? "" : form.hours })}
                  />
                )}
              </div>

              {locked ? (
                <p className="text-[13.5px] text-text-secondary">
                  This week is locked ({(project.existing!.minutes / 60).toFixed(1)}h logged). Corrections need an amendment.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-[110px_1fr] items-center gap-x-5 gap-y-[18px]">
                    <span className="text-[13.5px] text-text-secondary">Hours</span>
                    <div className="flex items-center gap-[10px]">
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={form.hours}
                        disabled={form.nothingThisWeek}
                        onChange={(e) => updateProject(project.projectId, { hours: e.target.value })}
                        className="w-[70px] box-border rounded-[10px] border border-black/[.11] bg-white px-3 py-[9px] text-[15px] font-[590] text-text outline-none disabled:opacity-50"
                      />
                      <div className="flex gap-[6px]">
                        {QUICK_CHIP_HOURS.map((h) => (
                          <button
                            key={h}
                            type="button"
                            disabled={form.nothingThisWeek}
                            onClick={() => updateProject(project.projectId, { hours: String(h) })}
                            className={`rounded-full px-[13px] py-[7px] text-[13px] transition-all duration-150 disabled:opacity-40 ${
                              form.hours === String(h) ? "bg-accent font-[590] text-white" : "bg-control-track font-[500] text-text-secondary hover:text-text"
                            }`}
                          >
                            {h}h
                          </button>
                        ))}
                      </div>
                    </div>

                    <span className="text-[13.5px] text-text-secondary">Basis</span>
                    <SegmentedControl
                      segmentClassName="px-4 py-[7px]"
                      options={[
                        { value: "ESTIMATED", label: "Estimated" },
                        { value: "TRACKED", label: "From timesheet" },
                      ]}
                      value={form.basis}
                      onChange={(value) => updateProject(project.projectId, { basis: value as SubmissionBasis })}
                    />

                    {primaryUncertainty && (
                      <>
                        <span className="text-[13.5px] text-text-secondary">Uncertainty</span>
                        <span className="text-[14px] text-text">{primaryUncertainty.title}</span>
                      </>
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
                              <div className="mt-2 flex items-center gap-2">
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
                                  title="Hours spent specifically on this uncertainty (optional — feeds the planner's plan-vs-actual view)"
                                  value={selection.hours}
                                  onChange={(e) => setNoteHours(project.projectId, uncertainty.id, e.target.value)}
                                  className="w-16 shrink-0 rounded-[10px] border border-black/[.11] bg-white px-[10px] py-[9px] text-[13px] text-text outline-none"
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
                            placeholder="What's the uncertainty?"
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
                  <a href="/github" className="ml-auto text-[13px] font-[500]">
                    Review
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-7 flex items-center justify-between">
        <span className="text-[14.5px] text-text-secondary">
          Total <span className="font-[590] text-text">{totalHours.toFixed(1)}h</span> across {touchedCount} project{touchedCount === 1 ? "" : "s"}
        </span>
        <button type="button" onClick={logThisWeek} disabled={status === "saving"} className={buttonPrimary}>
          {status === "saving" ? "Logging…" : "Log this week"}
          <ArrowRightIcon />
        </button>
      </div>
      {status === "error" && <p className="mt-2 text-sm text-red-700">{errorMessage}</p>}
    </div>
  );
}
