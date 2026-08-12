"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/app/components/icons";
import { buttonGhost, buttonPrimary, input } from "@/app/components/ui";

/** The one editable field on a project post-creation — see lib/projects/repository.ts. Owner/Lead only (project:update). */
export function ProjectDescription({
  projectId,
  companyId,
  description,
  canEdit,
}: {
  projectId: string;
  companyId: string;
  description: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(description ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  async function save() {
    setStatus("saving");
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, description: value }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not save description");
      }
      setEditing(false);
      setStatus("idle");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save description");
      setStatus("error");
    }
  }

  if (editing) {
    return (
      <div className="mt-3 flex flex-col gap-2">
        <textarea
          rows={3}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="What is this project, in a sentence or two?"
          className={input}
        />
        <div className="flex items-center gap-3">
          <button type="button" onClick={save} disabled={status === "saving"} className={buttonPrimary}>
            {status === "saving" && <Spinner />}
            {status === "saving" ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setValue(description ?? "");
              setStatus("idle");
              setError("");
            }}
            className={buttonGhost}
          >
            Cancel
          </button>
        </div>
        {status === "error" && <p className="m-0 text-[13px] text-red-700">{error}</p>}
      </div>
    );
  }

  if (!description) {
    return canEdit ? (
      <button type="button" onClick={() => setEditing(true)} className={`mt-2 ${buttonGhost}`}>
        + Add description
      </button>
    ) : null;
  }

  return (
    <div className="mt-2 flex items-start gap-2">
      <p className="m-0 max-w-[62ch] text-[14px] leading-[1.5] text-text-secondary">{description}</p>
      {canEdit && (
        <button type="button" onClick={() => setEditing(true)} className={`shrink-0 ${buttonGhost}`}>
          Edit
        </button>
      )}
    </div>
  );
}
