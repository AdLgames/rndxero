"use client";

import { useState } from "react";
import type { SubmissionBasis, UncertaintyNoteType } from "@/lib/generated/prisma/client";
import { Panel } from "@/app/components/Panel";
import { badgeSage, buttonGhost, buttonPrimary, chip, chipActive, eyebrow, input, select } from "@/app/components/ui";

export interface ProjectCaptureData {
  projectId: string;
  projectName: string;
  companyId: string;
  uncertainties: Array<{ id: string; title: string }>;
  prefillMinutes: number | null;
  existing: { minutes: number; basis: SubmissionBasis; locked: boolean } | null;
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
    return <p className="text-sm text-foreground/60">No projects to log time against yet — ask your project lead to add you.</p>;
  }

  if (status === "done") {
    const totalHours = loggedSummary.reduce((sum, s) => sum + s.hours, 0);
    return (
      <Panel className="border-sage bg-sage/5 p-4 text-sm">
        <p className="font-semibold text-sage-dark">
          Week {weekKey} logged — {totalHours}h total.
        </p>
        <ul className="mt-2 flex flex-col gap-1 text-foreground/70">
          {loggedSummary.map((s) => (
            <li key={s.projectName}>
              {s.projectName}: {s.hours}h
            </li>
          ))}
        </ul>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {projects.map((project) => {
        const form = state[project.projectId];
        const locked = project.existing?.locked ?? false;
        return (
          <Panel key={project.projectId} className={`p-4 ${locked ? "border-sage bg-sage/5" : ""}`}>
            <h2 className="text-base font-bold text-foreground">{project.projectName}</h2>
            {locked ? (
              <p className="mt-2 text-sm text-sage-dark">
                <span className={badgeSage}>Sealed</span> — {(project.existing!.minutes / 60).toFixed(1)}h logged.
                Corrections need an amendment.
              </p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className={eyebrow}>
                    Hours
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={form.hours}
                      disabled={form.nothingThisWeek}
                      onChange={(e) => updateProject(project.projectId, { hours: e.target.value })}
                      className="ml-2 w-20 border border-steel/40 bg-white px-2 py-1 text-sm normal-case text-foreground disabled:opacity-50"
                    />
                  </label>
                  {QUICK_CHIP_HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      disabled={form.nothingThisWeek}
                      onClick={() => updateProject(project.projectId, { hours: String(h) })}
                      className={`${form.hours === String(h) ? chipActive : chip} disabled:opacity-40`}
                    >
                      {h}h
                    </button>
                  ))}
                  <label className="ml-auto flex items-center gap-2 text-xs text-foreground/60">
                    <input
                      type="checkbox"
                      checked={form.nothingThisWeek}
                      onChange={(e) => updateProject(project.projectId, { nothingThisWeek: e.target.checked, hours: "" })}
                    />
                    Nothing this week
                  </label>
                </div>

                <select
                  value={form.basis}
                  onChange={(e) => updateProject(project.projectId, { basis: e.target.value as SubmissionBasis })}
                  className={`mt-3 ${select}`}
                >
                  <option value="ESTIMATED">Estimated</option>
                  <option value="TRACKED">From timesheet</option>
                </select>

                {!form.nothingThisWeek && (
                  <div className="mt-4 flex flex-col gap-3">
                    {project.uncertainties.map((uncertainty) => {
                      const selection = form.notes[uncertainty.id];
                      return (
                        <div key={uncertainty.id} className="border border-steel/20 p-3">
                          <p className="text-sm font-semibold text-foreground">{uncertainty.title}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {TAP_OPTIONS.map((option) => {
                              const isActive = selection?.type === option.type;
                              const activeClass = option.type === "RESOLUTION" ? chipActive.replace("bg-steel", "bg-sage").replace("border-steel", "border-sage") : chipActive;
                              return (
                                <button
                                  key={option.type}
                                  type="button"
                                  onClick={() => selectNote(project.projectId, uncertainty.id, option.type)}
                                  className={isActive ? activeClass : chip}
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
                                className="w-full border border-steel/40 bg-white px-2 py-1 text-sm text-foreground"
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.25"
                                placeholder="hrs"
                                title="Hours spent specifically on this uncertainty (optional — feeds the planner's plan-vs-actual view)"
                                value={selection.hours}
                                onChange={(e) => setNoteHours(project.projectId, uncertainty.id, e.target.value)}
                                className="w-16 shrink-0 border border-steel/40 bg-white px-2 py-1 text-sm text-foreground"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {form.newUncertaintyOpen ? (
                      <div className="border border-dashed border-steel/40 p-3">
                        <input
                          type="text"
                          placeholder="What's the uncertainty?"
                          value={form.newTitle}
                          onChange={(e) => updateProject(project.projectId, { newTitle: e.target.value })}
                          className={input.replace("mt-1 ", "")}
                        />
                        <input
                          type="text"
                          placeholder="What didn't we know?"
                          value={form.newBaseline}
                          onChange={(e) => updateProject(project.projectId, { newBaseline: e.target.value })}
                          className={`mt-2 ${input.replace("mt-1 ", "")}`}
                        />
                        <button type="button" onClick={() => createUncertainty(project)} className={`${buttonPrimary} mt-2`}>
                          Add
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateProject(project.projectId, { newUncertaintyOpen: true })}
                        className={`self-start ${buttonGhost}`}
                      >
                        + Something new came up
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </Panel>
        );
      })}

      <div>
        <button type="button" onClick={logThisWeek} disabled={status === "saving"} className={`${buttonPrimary} px-6 py-2.5`}>
          {status === "saving" ? "Logging…" : "Log this week"}
        </button>
        {status === "error" && <p className="mt-2 text-sm text-red-700">{errorMessage}</p>}
      </div>
    </div>
  );
}
