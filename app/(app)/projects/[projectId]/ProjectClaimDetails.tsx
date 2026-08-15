"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectStatus, QualificationStatus } from "@/lib/generated/prisma/client";
import { Spinner } from "@/app/components/icons";
import { buttonGhost, buttonPrimary, fieldLabel, input } from "@/app/components/ui";

const STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: "PLANNED", label: "Planned" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ABANDONED", label: "Abandoned" },
];

const QUALIFICATION_OPTIONS: Array<{ value: QualificationStatus; label: string }> = [
  { value: "UNDECIDED", label: "Undecided" },
  { value: "QUALIFYING", label: "Qualifying" },
  { value: "NON_QUALIFYING", label: "Non-qualifying" },
];

export interface ProjectClaimDetailsData {
  status: ProjectStatus;
  fieldOfScienceOrTechnology: string | null;
  advanceSought: string | null;
  qualificationStatus: QualificationStatus;
}

/**
 * The fields the UK Additional Information Form asks for at project
 * level, beyond what's already captured elsewhere (baseline lives on
 * each Uncertainty; competent professionals and description have their
 * own sections). qualificationStatus is the one field here that's purely
 * a human call — it defaults to, and can only be set back to, Undecided
 * by a person; the app never infers or defaults it to a decided value.
 */
export function ProjectClaimDetails({
  projectId,
  companyId,
  data,
  canEdit,
}: {
  projectId: string;
  companyId: string;
  data: ProjectClaimDetailsData;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [status, setProjectStatus] = useState(data.status);
  const [fieldOfScience, setFieldOfScience] = useState(data.fieldOfScienceOrTechnology ?? "");
  const [advanceSought, setAdvanceSought] = useState(data.advanceSought ?? "");
  const [qualificationStatus, setQualificationStatus] = useState(data.qualificationStatus);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  function reset() {
    setProjectStatus(data.status);
    setFieldOfScience(data.fieldOfScienceOrTechnology ?? "");
    setAdvanceSought(data.advanceSought ?? "");
    setQualificationStatus(data.qualificationStatus);
    setSaveStatus("idle");
    setError("");
  }

  async function save() {
    setSaveStatus("saving");
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          status,
          fieldOfScienceOrTechnology: fieldOfScience,
          advanceSought,
          qualificationStatus,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not save");
      }
      setEditing(false);
      setSaveStatus("idle");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setSaveStatus("error");
    }
  }

  const statusLabel = STATUS_OPTIONS.find((o) => o.value === data.status)?.label ?? data.status;
  const qualificationLabel = QUALIFICATION_OPTIONS.find((o) => o.value === data.qualificationStatus)?.label ?? data.qualificationStatus;

  if (!editing) {
    return (
      <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className={fieldLabel}>Status</p>
              <p className="m-0 text-[14px] text-text">{statusLabel}</p>
            </div>
            <div>
              <p className={fieldLabel}>Qualification tag</p>
              <p className="m-0 text-[14px] text-text">{qualificationLabel}</p>
            </div>
            <div>
              <p className={fieldLabel}>Field of science or technology</p>
              <p className="m-0 text-[14px] text-text">{data.fieldOfScienceOrTechnology || "—"}</p>
            </div>
            <div>
              <p className={fieldLabel}>Advance sought</p>
              <p className="m-0 text-[14px] text-text">{data.advanceSought || "—"}</p>
            </div>
          </div>
          {canEdit && (
            <button type="button" onClick={() => setEditing(true)} className={buttonGhost}>
              Edit
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={fieldLabel}>Status</label>
          <select value={status} onChange={(e) => setProjectStatus(e.target.value as ProjectStatus)} className={input}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={fieldLabel}>Qualification tag</label>
          <select value={qualificationStatus} onChange={(e) => setQualificationStatus(e.target.value as QualificationStatus)} className={input}>
            {QUALIFICATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={fieldLabel}>Field of science or technology</label>
          <input value={fieldOfScience} onChange={(e) => setFieldOfScience(e.target.value)} placeholder="e.g. Robotics and control systems" className={input} />
        </div>
        <div>
          <label className={fieldLabel}>Advance sought</label>
          <input value={advanceSought} onChange={(e) => setAdvanceSought(e.target.value)} placeholder="What is this project trying to achieve?" className={input} />
        </div>
      </div>

      {saveStatus === "error" && <p className="m-0 mt-3 text-[13px] text-red-700">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={saveStatus === "saving"} className={buttonPrimary}>
          {saveStatus === "saving" && <Spinner />}
          {saveStatus === "saving" ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            reset();
          }}
          className={buttonGhost}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
