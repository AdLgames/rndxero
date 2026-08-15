"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/app/components/icons";
import { buttonGhost, buttonPrimary, fieldLabel, input } from "@/app/components/ui";

export interface CompanyAifDetailsData {
  utr: string | null;
  seniorOfficerName: string | null;
  seniorOfficerRole: string | null;
}

/** Fields the UK Additional Information Form asks for at company level — filled in once, not required to start capturing evidence. */
export function CompanyAifDetails({ companyId, data }: { companyId: string; data: CompanyAifDetailsData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [utr, setUtr] = useState(data.utr ?? "");
  const [officerName, setOfficerName] = useState(data.seniorOfficerName ?? "");
  const [officerRole, setOfficerRole] = useState(data.seniorOfficerRole ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  async function save() {
    setStatus("saving");
    setError("");
    try {
      const response = await fetch(`/api/companies/${companyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ utr, seniorOfficerName: officerName, seniorOfficerRole: officerRole }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not save");
      }
      setEditing(false);
      setStatus("idle");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
      setStatus("error");
    }
  }

  if (!editing) {
    return (
      <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className={fieldLabel}>Company UTR</p>
              <p className="m-0 text-[14px] text-text">{data.utr || "—"}</p>
            </div>
            <div>
              <p className={fieldLabel}>Senior officer</p>
              <p className="m-0 text-[14px] text-text">{data.seniorOfficerName || "—"}</p>
            </div>
            <div>
              <p className={fieldLabel}>Officer role</p>
              <p className="m-0 text-[14px] text-text">{data.seniorOfficerRole || "—"}</p>
            </div>
          </div>
          <button type="button" onClick={() => setEditing(true)} className={buttonGhost}>
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={fieldLabel}>Company UTR</label>
          <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="10 digits" className={input} />
        </div>
        <div>
          <label className={fieldLabel}>Senior officer name</label>
          <input value={officerName} onChange={(e) => setOfficerName(e.target.value)} placeholder="e.g. Jane Smith" className={input} />
        </div>
        <div>
          <label className={fieldLabel}>Officer role</label>
          <input value={officerRole} onChange={(e) => setOfficerRole(e.target.value)} placeholder="e.g. CFO" className={input} />
        </div>
      </div>

      {status === "error" && <p className="m-0 mt-3 text-[13px] text-red-700">{error}</p>}

      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={status === "saving"} className={buttonPrimary}>
          {status === "saving" && <Spinner />}
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setUtr(data.utr ?? "");
            setOfficerName(data.seniorOfficerName ?? "");
            setOfficerRole(data.seniorOfficerRole ?? "");
            setStatus("idle");
            setError("");
          }}
          className={buttonGhost}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
