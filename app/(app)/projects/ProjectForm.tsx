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
    <form onSubmit={handleSubmit} className="rounded-[16px] border border-black/[.06] bg-white p-6">
      <h5 className="m-0 mb-[18px] text-[15px] font-[600] tracking-[-0.02em] text-text">New project</h5>
      <div className="mb-4 grid grid-cols-[1fr_170px] gap-4">
        <label className="block">
          <span className={fieldLabel}>Project name</span>
          <input type="text" required placeholder="Adaptive gripper control" value={name} onChange={(e) => setName(e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className={fieldLabel}>Start date</span>
          <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} />
        </label>
      </div>
      <label className="mb-2 block">
        <span className={fieldLabel}>Competent professionals</span>
        <input
          type="text"
          required
          placeholder="Ada Lovelace, Bo Chen"
          value={competentProfessionals}
          onChange={(e) => setCompetentProfessionals(e.target.value)}
          className={input}
        />
      </label>
      <p className="m-0 mb-5 text-[12.5px] text-text-quaternary">The people whose judgement resolved the uncertainty.</p>
      <button type="submit" disabled={status === "saving"} className={buttonPrimary}>
        Create project
      </button>
      {status === "error" && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </form>
  );
}
