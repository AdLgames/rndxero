"use client";

import { useState } from "react";
import type { SubmissionBasis, UncertaintyNoteType } from "@/lib/generated/prisma/client";
import { Panel } from "@/app/components/Panel";
import { badgeNeutral, badgeSage, buttonGhost, buttonPrimary, buttonSecondary, chip, chipActive, eyebrow, input } from "@/app/components/ui";

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
  uncertaintyTitle: string;
  amendments: AmendmentData[];
}

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

function AmendmentList({ amendments }: { amendments: AmendmentData[] }) {
  if (amendments.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1 border-l-2 border-sage pl-3">
      {amendments.map((a) => (
        <li key={a.id} className="text-xs text-foreground/70">
          <span className="font-semibold text-sage-dark">Correction</span> by {a.authorName}, {formatDate(a.createdAt)}: {a.body}
        </li>
      ))}
    </ul>
  );
}

function AddCorrectionForm({ onSubmit }: { onSubmit: (body: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`mt-1 ${buttonGhost}`}>
        + Add correction
      </button>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-1">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What should this correct, and to what?"
        rows={2}
        className={input.replace("mt-1 ", "text-xs ")}
      />
      <div className="flex items-center gap-2">
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
          className={`${buttonPrimary} px-2 py-1 text-xs`}
        >
          {saving ? "Saving…" : "Save correction"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-foreground/50">
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

function SubmissionCard({ row, onChange }: { row: SubmissionRow; onChange: (updated: SubmissionRow) => void }) {
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const locked = row.lockedAt !== null;

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
        body: JSON.stringify({
          companyId: row.companyId,
          projectId: row.projectId,
          submissionId: row.id,
          reason: unlockReason.trim(),
        }),
      });
      const body = (await response.json()) as { submission?: { lockedAt: string | null }; error?: string };
      if (!response.ok || !body.submission) throw new Error(body.error ?? "Could not unlock");
      onChange({
        ...row,
        lockedAt: body.submission.lockedAt,
        lockHistory: [
          ...row.lockHistory,
          {
            id: `local-${Date.now()}`,
            action: "submission.unlock",
            actorName: "You",
            reason: unlockReason.trim(),
            createdAt: new Date().toISOString(),
          },
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
    onChange({
      ...row,
      notes: row.notes.map((n) => (n.id === noteId ? { ...n, amendments: [...n.amendments, json.amendment!] } : n)),
    });
  }

  return (
    <Panel className={`p-4 ${locked ? "border-sage bg-sage/5" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {row.projectName} · {row.userName} · Week {row.weekKey}
          </p>
          <p className="mt-0.5 text-xs text-foreground/60">
            {(row.minutes / 60).toFixed(2)}h ({row.basis.toLowerCase()}) · submitted {formatDate(row.submittedAt)}
            {row.isRetrospective ? " · retrospective" : ""}
          </p>
        </div>

        {locked ? <span className={badgeSage}>Sealed {formatDate(row.lockedAt!)}</span> : <span className={badgeNeutral}>Open</span>}
      </div>

      <AmendmentList amendments={row.amendments} />
      <AddCorrectionForm onSubmit={amendSubmission} />

      {row.notes.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2 border-t border-steel/20 pt-3">
          {row.notes.map((note) => (
            <li key={note.id} className="text-sm">
              <p className="text-foreground">
                <span className={eyebrow}>{note.type.replace("_", " ")}</span> — {note.uncertaintyTitle}
              </p>
              <p className="text-foreground/70">{note.body}</p>
              <AmendmentList amendments={note.amendments} />
              <AddCorrectionForm onSubmit={(body) => amendNote(note.id, body)} />
            </li>
          ))}
        </ul>
      )}

      {row.lockHistory.length > 0 && (
        <details className="mt-3 text-xs text-foreground/50">
          <summary className="cursor-pointer">Lock history ({row.lockHistory.length})</summary>
          <ul className="mt-1 flex flex-col gap-1">
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

      <div className="mt-3 flex items-center gap-2">
        {locked ? (
          unlockOpen ? (
            <div className="flex w-full flex-col gap-1">
              <input
                type="text"
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="Reason for unlocking (required, kept on this week permanently)"
                className={input.replace("mt-1 ", "text-xs ")}
              />
              <div className="flex gap-2">
                <button type="button" disabled={busy || !unlockReason.trim()} onClick={unlock} className={`${buttonPrimary} px-3 py-1 text-xs`}>
                  {busy ? "Unlocking…" : "Confirm unlock"}
                </button>
                <button type="button" onClick={() => setUnlockOpen(false)} className="text-xs text-foreground/50">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setUnlockOpen(true)} className={`${buttonSecondary} px-3 py-1 text-xs`}>
              Unlock
            </button>
          )
        ) : (
          <button type="button" disabled={busy} onClick={lock} className={`${buttonPrimary} px-3 py-1 text-xs`}>
            {busy ? "Locking…" : "Lock week"}
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </Panel>
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
    return <p className="text-sm text-foreground/60">No submitted weeks yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(["all", "open", "locked"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={filter === f ? chipActive : chip}>
            {f === "all" ? "All" : f === "open" ? "Open" : "Locked"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {visible.map((row) => (
          <SubmissionCard key={row.id} row={row} onChange={updateRow} />
        ))}
        {visible.length === 0 && <p className="text-sm text-foreground/60">Nothing matches this filter.</p>}
      </div>
    </div>
  );
}
