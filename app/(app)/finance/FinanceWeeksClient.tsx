"use client";

import { useState } from "react";
import Link from "next/link";
import type { SubmissionBasis, UncertaintyNoteType } from "@/lib/generated/prisma/client";
import { weekComplianceStatus, type WeekComplianceStatus } from "@/lib/compliance/readiness";
import { SegmentedControl } from "@/app/components/SegmentedControl";
import { LockIcon } from "@/app/components/icons";
import { badgeAccent, badgeNeutral, buttonGhost, buttonPrimary, buttonSecondary, input } from "@/app/components/ui";

interface AmendmentData {
  id: string;
  body: string;
  authorName: string;
  createdAt: string;
}

interface NoteData {
  id: string;
  type: UncertaintyNoteType;
  body: string;
  evidenceRef: string | null;
  uncertaintyTitle: string;
  amendments: AmendmentData[];
}

const STATUS_STYLE: Record<WeekComplianceStatus, { dot: string; label: string }> = {
  green: { dot: "bg-accent", label: "Fully backed" },
  amber: { dot: "bg-[#C88A1E]", label: "Missing narrative or evidence" },
  red: { dot: "bg-[#C0392B]", label: "Unconfirmed" },
};

interface LockHistoryEntry {
  id: string;
  action: "submission.lock" | "submission.unlock" | "submission.auto_lock";
  actorName: string | null;
  reason: string | null;
  createdAt: string;
}

export interface SubmissionRow {
  id: string;
  companyId: string;
  companyName: string;
  projectId: string;
  projectName: string;
  userName: string;
  userEmail: string;
  weekKey: string;
  minutes: number;
  basis: SubmissionBasis;
  submittedAt: string;
  isRetrospective: boolean;
  lockedAt: string | null;
  notes: NoteData[];
  amendments: AmendmentData[];
  lockHistory: LockHistoryEntry[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function AmendmentNote({ amendment, deltaLabel }: { amendment: AmendmentData; deltaLabel?: string }) {
  return (
    <div className="mt-[14px] rounded-[12px] border border-black/[.06] bg-white p-[14px_16px]">
      <span className={badgeAccent}>{deltaLabel ?? "Amendment"}</span>
      <p className="m-0 mt-2 text-[13.5px] leading-[1.5] text-text-secondary">
        {amendment.body} Added by {amendment.authorName}, {formatDate(amendment.createdAt)}.
      </p>
    </div>
  );
}

function AddCorrectionForm({ onSubmit }: { onSubmit: (body: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`mt-[10px] ${buttonGhost}`}>
        + Add correction
      </button>
    );
  }

  return (
    <div className="mt-[10px] flex flex-col gap-2">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What should this correct, and to what?" rows={2} className={input} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saving || !body.trim()}
          onClick={async () => {
            setSaving(true);
            setError("");
            try {
              await onSubmit(body.trim());
              setBody("");
              setOpen(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not save correction");
            } finally {
              setSaving(false);
            }
          }}
          className={buttonPrimary}
        >
          {saving ? "Saving…" : "Save correction"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={buttonGhost}>
          Cancel
        </button>
      </div>
      {error && <p className="m-0 text-[13px] text-red-700">{error}</p>}
    </div>
  );
}

function SubmissionCard({ row, onChange }: { row: SubmissionRow; onChange: (updated: SubmissionRow) => void }) {
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const locked = row.lockedAt !== null;
  const complianceStatus = weekComplianceStatus({
    submitted: true,
    minutes: row.minutes,
    notes: row.notes.filter((n) => n.type !== "NO_PROGRESS").map((n) => ({ body: n.body, evidenceRef: n.evidenceRef })),
  });

  async function lock() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/locking/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: row.companyId, projectId: row.projectId, submissionId: row.id }),
      });
      const body = (await response.json()) as { submission?: { lockedAt: string | null }; error?: string };
      if (!response.ok || !body.submission) throw new Error(body.error ?? "Could not lock");
      onChange({
        ...row,
        lockedAt: body.submission.lockedAt,
        lockHistory: [
          ...row.lockHistory,
          { id: `local-${Date.now()}`, action: "submission.lock", actorName: "You", reason: null, createdAt: new Date().toISOString() },
        ],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not lock");
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    if (!unlockReason.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/locking/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: row.companyId, projectId: row.projectId, submissionId: row.id, reason: unlockReason.trim() }),
      });
      const body = (await response.json()) as { submission?: { lockedAt: string | null }; error?: string };
      if (!response.ok || !body.submission) throw new Error(body.error ?? "Could not unlock");
      onChange({
        ...row,
        lockedAt: body.submission.lockedAt,
        lockHistory: [
          ...row.lockHistory,
          { id: `local-${Date.now()}`, action: "submission.unlock", actorName: "You", reason: unlockReason.trim(), createdAt: new Date().toISOString() },
        ],
      });
      setUnlockOpen(false);
      setUnlockReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unlock");
    } finally {
      setBusy(false);
    }
  }

  async function amendSubmission(body: string) {
    const response = await fetch("/api/locking/amend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: row.companyId, submissionId: row.id, body }),
    });
    const json = (await response.json()) as { amendment?: AmendmentData; error?: string };
    if (!response.ok || !json.amendment) throw new Error(json.error ?? "Could not save correction");
    onChange({ ...row, amendments: [...row.amendments, json.amendment] });
  }

  async function amendNote(noteId: string, body: string) {
    const response = await fetch("/api/locking/amend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: row.companyId, noteId, body }),
    });
    const json = (await response.json()) as { amendment?: AmendmentData; error?: string };
    if (!response.ok || !json.amendment) throw new Error(json.error ?? "Could not save correction");
    onChange({ ...row, notes: row.notes.map((n) => (n.id === noteId ? { ...n, amendments: [...n.amendments, json.amendment!] } : n)) });
  }

  const allAmendments = [
    ...row.amendments.map((a) => ({ ...a, context: null as string | null })),
    ...row.notes.flatMap((n) => n.amendments.map((a) => ({ ...a, context: n.uncertaintyTitle as string | null }))),
  ];

  return (
    <div className={`rounded-[16px] border p-[22px_24px] ${locked ? "border-accent-border bg-accent-wash" : "border-black/[.06] bg-surface-sunken"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-[10px]">
            <p className="m-0 text-[15.5px] font-[600] tracking-[-0.02em] text-text">
              <Link href={`/projects/${row.projectId}`} className="hover:underline">
                {row.projectName}
              </Link>{" "}
              · {row.userName} · {row.weekKey}
            </p>
            {complianceStatus && (
              <span
                className="flex items-center gap-[6px] rounded-full bg-control-track px-[10px] py-[3px] text-[11px] font-[500] text-text-secondary"
                title={STATUS_STYLE[complianceStatus].label}
              >
                <span className={`h-[7px] w-[7px] rounded-full ${STATUS_STYLE[complianceStatus].dot}`} />
                {STATUS_STYLE[complianceStatus].label}
              </span>
            )}
          </div>
          <p className="m-0 mt-[4px] text-[13px] text-text-tertiary">
            {(row.minutes / 60).toFixed(2)}h {row.basis.toLowerCase()} · submitted {formatDate(row.submittedAt)}
            {row.isRetrospective ? " · retrospective" : ""}
          </p>
          {!locked && <AddCorrectionForm onSubmit={amendSubmission} />}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3">
          {locked ? (
            <span className={`${badgeAccent} gap-[6px]`}>
              <LockIcon className="h-[10px] w-[10px]" /> Locked
            </span>
          ) : (
            <>
              <span className={badgeNeutral}>Open</span>
              <button type="button" disabled={busy} onClick={lock} className={buttonSecondary}>
                {busy ? "Locking…" : "Lock week"}
              </button>
            </>
          )}
        </div>
      </div>

      {allAmendments.map((a) => (
        <AmendmentNote key={a.id} amendment={a} deltaLabel={a.context ? `Amendment · ${a.context}` : "Amendment"} />
      ))}

      {row.notes.length > 0 && (
        <ul className="m-0 mt-4 flex list-none flex-col gap-2 border-t border-black/[.055] p-0 pt-4">
          {row.notes.map((note) => (
            <li key={note.id} className="text-[13.5px]">
              <p className="m-0 text-text">
                <span className="text-[11.5px] font-[590] text-text-tertiary">{note.type.replace("_", " ")}</span> — {note.uncertaintyTitle}
              </p>
              <p className="m-0 mt-[2px] text-text-secondary">{note.body}</p>
              {!locked && <AddCorrectionForm onSubmit={(body) => amendNote(note.id, body)} />}
            </li>
          ))}
        </ul>
      )}

      {row.lockHistory.length > 0 && (
        <details className="mt-4 text-[12.5px] text-text-tertiary">
          <summary className="cursor-pointer">Lock history ({row.lockHistory.length})</summary>
          <ul className="m-0 mt-1 flex list-none flex-col gap-1 p-0">
            {row.lockHistory.map((h) => (
              <li key={h.id}>
                {formatDate(h.createdAt)} — {h.action === "submission.auto_lock" ? "auto-locked" : h.action === "submission.lock" ? "locked" : "unlocked"}
                {h.actorName ? ` by ${h.actorName}` : " by the system"}
                {h.reason ? `: "${h.reason}"` : ""}
              </li>
            ))}
          </ul>
        </details>
      )}

      {locked && (
        <div className="mt-4">
          {unlockOpen ? (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="Reason for unlocking (required, kept on this week permanently)"
                className={input}
              />
              <div className="flex items-center gap-3">
                <button type="button" disabled={busy || !unlockReason.trim()} onClick={unlock} className={buttonPrimary}>
                  {busy ? "Unlocking…" : "Confirm unlock"}
                </button>
                <button type="button" onClick={() => setUnlockOpen(false)} className={buttonGhost}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setUnlockOpen(true)} className={buttonGhost}>
              Unlock
            </button>
          )}
        </div>
      )}
      {error && <p className="m-0 mt-2 text-[13px] text-red-700">{error}</p>}
    </div>
  );
}

export function FinanceWeeksClient({ submissions }: { submissions: SubmissionRow[] }) {
  const [rows, setRows] = useState(submissions);
  const [filter, setFilter] = useState<"all" | "open" | "locked">("all");

  function updateRow(updated: SubmissionRow) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  const visible = rows.filter((r) => (filter === "all" ? true : filter === "locked" ? r.lockedAt !== null : r.lockedAt === null));

  if (rows.length === 0) {
    return <p className="text-[14px] text-text-secondary">No submitted weeks yet.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <SegmentedControl
        options={[
          { value: "all", label: "All" },
          { value: "open", label: "Open" },
          { value: "locked", label: "Locked" },
        ]}
        value={filter}
        onChange={setFilter}
        className="w-max"
      />

      <div className="flex flex-col gap-[14px]">
        {visible.map((row) => (
          <SubmissionCard key={row.id} row={row} onChange={updateRow} />
        ))}
        {visible.length === 0 && <p className="text-[14px] text-text-secondary">Nothing matches this filter.</p>}
      </div>
    </div>
  );
}
