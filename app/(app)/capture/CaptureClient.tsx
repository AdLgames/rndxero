"use client";

import { useState } from "react";
import type { SubmissionBasis, UncertaintyNoteType } from "@/lib/generated/prisma/client";

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
    setState((prev) => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        notes: { ...prev[projectId].notes, [uncertaintyId]: { type, body: prev[projectId].notes[uncertaintyId]?.body ?? "" } },
      },
    }));
  }

  function setNoteBody(projectId: string, uncertaintyId: string, body: string) {
    setState((prev) => {
      const existingNote = prev[projectId].notes[uncertaintyId] ?? { type: null, body: "" };
      return {
        ...prev,
        [projectId]: { ...prev[projectId], notes: { ...prev[projectId].notes, [uncertaintyId]: { ...existingNote, body } } },
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
          .map(([uncertaintyId, selection]) => ({
            uncertaintyId,
            type: selection.type as UncertaintyNoteType,
            body: selection.body.trim() || (selection.type === "NO_PROGRESS" ? "No progress this week." : ""),
          }));

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
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No projects to log time against yet — ask your project lead to add you.
      </p>
    );
  }

  if (status === "done") {
    const totalHours = loggedSummary.reduce((sum, s) => sum + s.hours, 0);
    return (
      <div className="rounded bg-black/[.04] p-4 text-sm text-black dark:bg-white/[.08] dark:text-zinc-50">
        <p className="font-medium">Week {weekKey} logged — {totalHours}h total.</p>
        <ul className="mt-2 flex flex-col gap-1 text-zinc-600 dark:text-zinc-400">
          {loggedSummary.map((s) => (
            <li key={s.projectName}>
              {s.projectName}: {s.hours}h
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {projects.map((project) => {
        const form = state[project.projectId];
        const locked = project.existing?.locked ?? false;
        return (
          <section key={project.projectId} className="rounded border border-black/[.08] p-4 dark:border-white/[.08]">
            <h2 className="text-base font-medium text-black dark:text-zinc-50">{project.projectName}</h2>
            {locked ? (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                This week is locked ({(project.existing!.minutes / 60).toFixed(1)}h logged). Corrections need an
                amendment.
              </p>
            ) : (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="text-sm text-black dark:text-zinc-50">
                    Hours
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={form.hours}
                      disabled={form.nothingThisWeek}
                      onChange={(e) => updateProject(project.projectId, { hours: e.target.value })}
                      className="ml-2 w-20 rounded border border-black/[.12] px-2 py-1 text-sm disabled:opacity-50 dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
                    />
                  </label>
                  {QUICK_CHIP_HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      disabled={form.nothingThisWeek}
                      onClick={() => updateProject(project.projectId, { hours: String(h) })}
                      className="rounded-full border border-black/[.12] px-3 py-1 text-xs disabled:opacity-50 dark:border-white/[.145] dark:text-zinc-50"
                    >
                      {h}h
                    </button>
                  ))}
                  <label className="ml-auto flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
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
                  className="mt-2 rounded border border-black/[.12] px-2 py-1 text-sm dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
                >
                  <option value="ESTIMATED">Estimated</option>
                  <option value="TRACKED">Tracked</option>
                </select>

                {!form.nothingThisWeek && (
                  <div className="mt-4 flex flex-col gap-3">
                    {project.uncertainties.map((uncertainty) => {
                      const selection = form.notes[uncertainty.id];
                      return (
                        <div key={uncertainty.id} className="rounded border border-black/[.06] p-3 dark:border-white/[.06]">
                          <p className="text-sm font-medium text-black dark:text-zinc-50">{uncertainty.title}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {TAP_OPTIONS.map((option) => (
                              <button
                                key={option.type}
                                type="button"
                                onClick={() => selectNote(project.projectId, uncertainty.id, option.type)}
                                className={`rounded-full border px-3 py-1 text-xs ${
                                  selection?.type === option.type
                                    ? "border-black bg-black text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-black"
                                    : "border-black/[.12] text-black dark:border-white/[.145] dark:text-zinc-50"
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          {selection?.type && selection.type !== "NO_PROGRESS" && (
                            <input
                              type="text"
                              placeholder="One line about what happened"
                              value={selection.body}
                              onChange={(e) => setNoteBody(project.projectId, uncertainty.id, e.target.value)}
                              className="mt-2 w-full rounded border border-black/[.12] px-2 py-1 text-sm dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
                            />
                          )}
                        </div>
                      );
                    })}

                    {form.newUncertaintyOpen ? (
                      <div className="rounded border border-dashed border-black/[.2] p-3 dark:border-white/[.2]">
                        <input
                          type="text"
                          placeholder="What's the uncertainty?"
                          value={form.newTitle}
                          onChange={(e) => updateProject(project.projectId, { newTitle: e.target.value })}
                          className="w-full rounded border border-black/[.12] px-2 py-1 text-sm dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
                        />
                        <input
                          type="text"
                          placeholder="What didn't we know?"
                          value={form.newBaseline}
                          onChange={(e) => updateProject(project.projectId, { newBaseline: e.target.value })}
                          className="mt-2 w-full rounded border border-black/[.12] px-2 py-1 text-sm dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
                        />
                        <button
                          type="button"
                          onClick={() => createUncertainty(project)}
                          className="mt-2 rounded bg-foreground px-3 py-1 text-xs font-medium text-background"
                        >
                          Add
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => updateProject(project.projectId, { newUncertaintyOpen: true })}
                        className="self-start text-sm text-zinc-600 underline dark:text-zinc-400"
                      >
                        + Something new came up
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}

      <div>
        <button
          type="button"
          onClick={logThisWeek}
          disabled={status === "saving"}
          className="rounded bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {status === "saving" ? "Logging…" : "Log this week"}
        </button>
        {status === "error" && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errorMessage}</p>}
      </div>
    </div>
  );
}
