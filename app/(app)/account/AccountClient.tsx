"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/app/components/icons";
import { buttonPrimary, buttonSecondary } from "@/app/components/ui";

/** Mirrors lib/gdpr/deletion.ts's DELETION_GRACE_DAYS — display only, the server enforces the real value. */
const DELETION_GRACE_DAYS = 7;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function AccountClient({ deletionRequestedAt: initialRequestedAt }: { deletionRequestedAt: string | null }) {
  const router = useRouter();
  const [exportStatus, setExportStatus] = useState<"idle" | "downloading">("idle");
  const [deletionRequestedAt, setDeletionRequestedAt] = useState(initialRequestedAt);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");

  async function downloadExport() {
    setExportStatus("downloading");
    try {
      const response = await fetch("/api/account/export");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "claimtrail-data-export.json";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportStatus("idle");
    }
  }

  async function submitDeletionRequest(action: "request" | "cancel") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account/deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await response.json()) as { deletionRequestedAt?: string | null; error?: string };
      if (!response.ok) throw new Error(json.error ?? "Could not save");
      setDeletionRequestedAt(json.deletionRequestedAt ?? null);
      setConfirmOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h3 className="m-0 mb-2 text-[15px] font-[600] text-text">Export your data</h3>
        <p className="m-0 mb-3 text-[13.5px] leading-[1.5] text-text-secondary">
          Download everything Trace holds that&apos;s tied to your account — hours you&apos;ve logged, notes and comments you&apos;ve written,
          amendments you&apos;ve authored, and your membership history — as a single JSON file.
        </p>
        <button type="button" onClick={downloadExport} disabled={exportStatus === "downloading"} className={buttonSecondary}>
          {exportStatus === "downloading" && <Spinner />}
          {exportStatus === "downloading" ? "Preparing…" : "Download my data"}
        </button>
      </section>

      <section className="flex flex-col items-start gap-3 rounded-[14px] border border-black/[.06] bg-surface-sunken px-[22px] py-[20px]">
        <div>
          <h3 className="m-0 mb-2 text-[15px] font-[600] text-text">Delete your account</h3>
          {deletionRequestedAt ? (
            <p className="m-0 text-[13.5px] leading-[1.5] text-text-secondary">
              Requested {fmtDate(deletionRequestedAt)}. Your name and email will be removed on{" "}
              <span className="font-[590] text-text">{fmtDate(addDays(deletionRequestedAt, DELETION_GRACE_DAYS))}</span> unless you cancel before
              then. Hours, notes, and other evidence you contributed stay in the record — required for the claims they support — just no longer
              attributed to a real name.
            </p>
          ) : (
            <p className="m-0 text-[13.5px] leading-[1.5] text-text-secondary">
              This removes your name and email from your account after a {DELETION_GRACE_DAYS}-day grace period, during which you can cancel.
              Evidence you contributed — hours, notes, comments, amendments — is never deleted, only anonymized: it stays in the record because
              the claims it supports depend on it.
            </p>
          )}
        </div>

        {deletionRequestedAt ? (
          <button type="button" onClick={() => submitDeletionRequest("cancel")} disabled={busy} className={buttonSecondary}>
            {busy && <Spinner />}
            {busy ? "Cancelling…" : "Cancel deletion request"}
          </button>
        ) : confirmOpen ? (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => submitDeletionRequest("request")} disabled={busy} className={buttonPrimary}>
              {busy && <Spinner />}
              {busy ? "Requesting…" : "Confirm — request deletion"}
            </button>
            <button type="button" onClick={() => setConfirmOpen(false)} className={buttonSecondary}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirmOpen(true)} className={buttonSecondary}>
            Request account deletion
          </button>
        )}
        {error && <p className="m-0 text-[13px] text-red-700">{error}</p>}
      </section>
    </div>
  );
}
