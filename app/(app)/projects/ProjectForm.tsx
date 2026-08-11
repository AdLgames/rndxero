"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buttonPrimary, fieldLabel, input } from "@/app/components/ui";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border border-steel/30 bg-white p-4">
      <label className={fieldLabel}>
        Project name
        <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={input} />
      </label>

      <label className={fieldLabel}>
        Start date
        <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} />
      </label>

      <label className={fieldLabel}>
        Competent professional(s)
        <input
          type="text"
          required
          placeholder="e.g. Dr. Ada Lovelace, Bo Chen"
          value={competentProfessionals}
          onChange={(e) => setCompetentProfessionals(e.target.value)}
          className={input}
        />
        <span className="mt-1 block text-xs normal-case text-foreground/50">Comma-separated names.</span>
      </label>

      <button type="submit" disabled={status === "saving"} className={`${buttonPrimary} mt-1`}>
        Create project
      </button>
      {status === "error" && <p className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
