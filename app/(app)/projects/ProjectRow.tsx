"use client";

import { useState } from "react";
import Link from "next/link";
import type { WorkerCostCategory } from "@/lib/generated/prisma/client";
import { ChevronDownIcon } from "@/app/components/icons";
import { badgeAccent, badgeNeutral } from "@/app/components/ui";

const CATEGORY_LABEL: Record<WorkerCostCategory, string> = {
  DIRECT_PAYE: "Direct PAYE staff",
  SUBCONTRACTOR_CONNECTED: "Subcontractor (connected)",
  SUBCONTRACTOR_UNCONNECTED: "Subcontractor (unconnected)",
  EPW: "EPW",
  CONSUMABLES: "Cloud / software consumables",
};

export interface ProjectRowMember {
  id: string;
  name: string;
  costCategory: WorkerCostCategory | null;
}

export interface ProjectRowData {
  id: string;
  name: string;
  archived: boolean;
  startDate: string;
  competentProfessionals: string;
  minutes: number;
  openUncertaintyTitle: string | null;
  members: ProjectRowMember[];
}

function hoursLabel(minutes: number): { value: string; unit: string } {
  return { value: (minutes / 60).toFixed(0), unit: "h" };
}

/**
 * Collapsed shows name/hours/status only (spec: "Compact / Accordion
 * Cards"); expanding reveals the technical baseline and the per-member
 * expenditure classification used for HMRC cost categorization, without
 * needing to leave Projects for a separate screen.
 */
export function ProjectRow({ project, companyId, canWriteCost }: { project: ProjectRowData; companyId: string; canWriteCost: boolean }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState(project.members);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { value, unit } = hoursLabel(project.minutes);
  const archived = project.archived;

  async function setCostCategory(memberId: string, costCategory: WorkerCostCategory | "") {
    setSavingId(memberId);
    try {
      const response = await fetch(`/api/project-members/${memberId}/cost-category`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, costCategory: costCategory || null }),
      });
      if (response.ok) {
        setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, costCategory: costCategory || null } : m)));
      }
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="rounded-[14px] border border-black/[.06] bg-surface-sunken">
      <div className="flex w-full items-center justify-between gap-[10px] px-[22px] py-5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Collapse project" : "Expand project"}
          className="shrink-0 text-text-quaternary"
        >
          <ChevronDownIcon className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        </button>
        <Link href={`/projects/${project.id}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-[10px]">
          <h4 className={`m-0 text-[16.5px] font-[600] tracking-[-0.02em] hover:underline ${archived ? "text-text-secondary" : "text-text"}`}>{project.name}</h4>
          <span className={archived ? badgeNeutral : badgeAccent}>{archived ? "Archived" : "Active"}</span>
        </Link>
        <button type="button" onClick={() => setOpen((o) => !o)} className="shrink-0 text-right">
          <div className={`text-[21px] font-[600] tracking-[-0.025em] ${archived ? "text-text-secondary" : "text-text"}`}>
            {value}
            <span className={`text-[14px] font-[500] ${archived ? "text-text-quaternary" : "text-text-tertiary"}`}>{unit}</span>
          </div>
          <div className="text-[11.5px] text-text-quaternary">logged</div>
        </button>
      </div>

      {open && (
        <div className="border-t border-black/[.055] px-[22px] py-5">
          <div className={`text-[13px] ${archived ? "text-text-quaternary" : "text-text-tertiary"}`}>
            Started {new Date(project.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} ·{" "}
            {project.competentProfessionals || "no competent professional named"}
          </div>

          {project.openUncertaintyTitle && (
            <p className="m-0 mt-3 text-[13.5px] leading-[1.5] text-text">
              <span className="text-text-tertiary">Open uncertainty — </span>
              {project.openUncertaintyTitle}
            </p>
          )}

          {members.length > 0 && (
            <div className="mt-4 border-t border-black/[.055] pt-4">
              <p className="m-0 mb-[10px] text-[12.5px] text-text-tertiary">Expenditure classification</p>
              <div className="flex flex-col gap-2">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-3">
                    <span className="text-[13.5px] text-text">{member.name}</span>
                    {canWriteCost ? (
                      <select
                        value={member.costCategory ?? ""}
                        disabled={savingId === member.id}
                        onChange={(e) => setCostCategory(member.id, e.target.value as WorkerCostCategory | "")}
                        className="rounded-[8px] border border-black/[.11] bg-white px-2 py-1 text-[12.5px] text-text outline-none disabled:opacity-50"
                      >
                        <option value="">Unclassified</option>
                        {(Object.keys(CATEGORY_LABEL) as WorkerCostCategory[]).map((key) => (
                          <option key={key} value={key}>
                            {CATEGORY_LABEL[key]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-[12.5px] text-text-tertiary">{member.costCategory ? CATEGORY_LABEL[member.costCategory] : "Unclassified"}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
