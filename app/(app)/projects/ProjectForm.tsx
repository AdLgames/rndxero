"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProjectForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [competentProfessionals, setCompetentProfessionals] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");

    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyId,
        name,
        startDate,
        competentProfessionals: competentProfessionals
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean),
      }),
    });

    if (response.ok) {
      setName("");
      setStartDate("");
      setCompetentProfessionals("");
      setStatus("idle");
      router.refresh();
      return;
    }

    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setError(body.error ?? "Could not create project");
    setStatus("error");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded border border-black/[.08] p-4 dark:border-white/[.08]">
      <label className="text-sm font-medium text-black dark:text-zinc-50">
        Project name
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded border border-black/[.12] px-3 py-2 text-sm dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
        />
      </label>

      <label className="text-sm font-medium text-black dark:text-zinc-50">
        Start date
        <input
          type="date"
          required
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="mt-1 w-full rounded border border-black/[.12] px-3 py-2 text-sm dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
        />
      </label>

      <label className="text-sm font-medium text-black dark:text-zinc-50">
        Competent professional(s)
        <input
          type="text"
          required
          placeholder="e.g. Dr. Ada Lovelace, Bo Chen"
          value={competentProfessionals}
          onChange={(e) => setCompetentProfessionals(e.target.value)}
          className="mt-1 w-full rounded border border-black/[.12] px-3 py-2 text-sm dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
        />
        <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">Comma-separated names.</span>
      </label>

      <button
        type="submit"
        disabled={status === "saving"}
        className="mt-1 rounded bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        Create project
      </button>
      {status === "error" && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
