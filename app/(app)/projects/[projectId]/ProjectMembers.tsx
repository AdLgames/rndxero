"use client";

import { useState } from "react";
import type { ProjectRole, WorkerCostCategory } from "@/lib/generated/prisma/client";
import { badgeAccent, badgeNeutral } from "@/app/components/ui";

const ROLE_LABEL: Record<ProjectRole, string> = {
  LEAD: "Owner",
  CONTRIBUTOR: "Contributor",
  ADVISER: "Adviser",
};

const CATEGORY_LABEL: Record<WorkerCostCategory, string> = {
  DIRECT_PAYE: "Direct PAYE staff",
  SUBCONTRACTOR_CONNECTED: "Subcontractor (connected)",
  SUBCONTRACTOR_UNCONNECTED: "Subcontractor (unconnected)",
  EPW: "EPW",
  CONSUMABLES: "Cloud / software consumables",
};

export interface ProjectMemberRow {
  id: string;
  userId: string;
  name: string;
  role: ProjectRole;
  costCategory: WorkerCostCategory | null;
}

function MemberRow({
  member,
  canWriteCost,
  saving,
  onChangeCostCategory,
}: {
  member: ProjectMemberRow;
  canWriteCost: boolean;
  saving: boolean;
  onChangeCostCategory: (memberId: string, costCategory: WorkerCostCategory | "") => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-[10px]">
      <div className="flex items-center gap-[8px]">
        <span className="text-[13.5px] text-text">{member.name}</span>
        <span className={member.role === "LEAD" ? badgeAccent : badgeNeutral}>{ROLE_LABEL[member.role]}</span>
      </div>
      {canWriteCost ? (
        <select
          value={member.costCategory ?? ""}
          disabled={saving}
          onChange={(e) => onChangeCostCategory(member.id, e.target.value as WorkerCostCategory | "")}
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
  );
}

/**
 * Owner (the project's LEAD — there's no separate "owner" concept in the
 * data model, and Lead already means "owns the plan" per the permission
 * matrix's own comments) surfaced first, everyone else underneath with
 * their role and — Owner/Lead only — an editable R&D expenditure
 * category. Ported from the old Projects-page accordion (ProjectRow),
 * which this component replaces now that Projects is a split-pane
 * dashboard rather than a list of expandable rows.
 */
export function ProjectMembers({ companyId, members: initialMembers, canWriteCost }: { companyId: string; members: ProjectMemberRow[]; canWriteCost: boolean }) {
  const [members, setMembers] = useState(initialMembers);
  const [savingId, setSavingId] = useState<string | null>(null);
  const owner = members.find((m) => m.role === "LEAD");
  const others = members.filter((m) => m.role !== "LEAD");

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

  if (members.length === 0) {
    return <p className="text-[13.5px] text-text-secondary">No one is assigned to this project yet.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-black/[.055]">
      {owner ? (
        <MemberRow member={owner} canWriteCost={canWriteCost} saving={savingId === owner.id} onChangeCostCategory={setCostCategory} />
      ) : (
        <p className="py-[10px] text-[13.5px] text-text-quaternary">No owner assigned yet.</p>
      )}
      {others.map((m) => (
        <MemberRow key={m.id} member={m} canWriteCost={canWriteCost} saving={savingId === m.id} onChangeCostCategory={setCostCategory} />
      ))}
    </div>
  );
}
