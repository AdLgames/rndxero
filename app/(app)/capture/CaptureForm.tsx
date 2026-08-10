"use client";

import { useState } from "react";
import type { TimeEntryBasis } from "@/lib/generated/prisma/client";

interface ProjectOption {
  id: string;
  name: string;
  companyId: string;
}

const BASIS_OPTIONS: { value: TimeEntryBasis; label: string }[] = [
  { value: "TIMESHEET", label: "Timesheet (tracked)" },
  { value: "SAMPLED", label: "Sampled (spot-checked)" },
  { value: "ESTIMATED", label: "Estimated" },
];

export function CaptureForm({
  projects,
  weekStart,
  weekEnd,
}: {
  projects: ProjectOption[];
  weekStart: string;
  weekEnd: string;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [hours, setHours] = useState("");
  const [basis, setBasis] = useState<TimeEntryBasis>("ESTIMATED");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  const project = projects.find((p) => p.id === projectId);

  async function handleConfirm(event: React.FormEvent) {
    event.preventDefault();
    if (!project) return;
    setStatus("saving");

    const response = await fetch("/api/time-entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId: project.companyId,
        projectId: project.id,
        periodStart: weekStart,
        periodEnd: weekEnd,
        minutes: Math.round(Number(hours) * 60),
        basis,
      }),
    });

    if (response.ok) {
      if (note.trim()) {
        await fetch("/api/evidence-entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId: project.companyId,
            projectId: project.id,
            type: "UNCERTAINTY_RAISED",
            body: note.trim(),
          }),
        });
      }
      setConfirmed((prev) => [...prev, `${project.name}: ${hours}h (${basis.toLowerCase()})`]);
      setHours("");
      setNote("");
      setStatus("idle");
    } else {
      setStatus("error");
    }
  }

  if (projects.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No R&D projects to log time against yet — ask your company admin to create one.
      </p>
    );
  }

  return (
    <div>
      <form onSubmit={handleConfirm} className="flex flex-col gap-3">
        <label className="text-sm font-medium text-black dark:text-zinc-50">
          Project
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="mt-1 w-full rounded border border-black/[.12] px-3 py-2 text-sm dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-black dark:text-zinc-50">
          Hours this week
          <input
            type="number"
            min="0"
            step="0.25"
            required
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="mt-1 w-full rounded border border-black/[.12] px-3 py-2 text-sm dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
          />
        </label>

        <label className="text-sm font-medium text-black dark:text-zinc-50">
          Basis
          <select
            value={basis}
            onChange={(e) => setBasis(e.target.value as TimeEntryBasis)}
            className="mt-1 w-full rounded border border-black/[.12] px-3 py-2 text-sm dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
          >
            {BASIS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-black dark:text-zinc-50">
          What were you uncertain about? (optional)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. wasn't sure the new indexing strategy would hold under concurrent writes"
            className="mt-1 w-full rounded border border-black/[.12] px-3 py-2 text-sm dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
          />
        </label>

        <button
          type="submit"
          disabled={status === "saving"}
          className="mt-2 rounded bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          Confirm
        </button>
        {status === "error" && (
          <p className="text-sm text-red-600 dark:text-red-400">Could not save — try again.</p>
        )}
      </form>

      {confirmed.length > 0 && (
        <ul className="mt-6 flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
          {confirmed.map((line, i) => (
            <li key={i}>✓ {line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
