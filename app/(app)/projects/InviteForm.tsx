"use client";

import { useState } from "react";
import type { MembershipRole } from "@/lib/generated/prisma/client";

const ROLE_OPTIONS: Array<{ value: MembershipRole; label: string }> = [
  { value: "ADVISER", label: "Adviser — free, read-only + export" },
  { value: "CONTRIBUTOR", label: "Contributor" },
  { value: "LEAD", label: "Lead" },
  { value: "FINANCE", label: "Finance" },
  { value: "OWNER", label: "Owner" },
];

/** Inviting an adviser is free and prominent (BOARD-PLAN.md Phase 8.1) — Adviser is the default role, not buried in a list. */
export function InviteForm({ companyId }: { companyId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MembershipRole>("ADVISER");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError("");

    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, email, role }),
    });

    if (response.ok) {
      setEmail("");
      setStatus("done");
      return;
    }

    const body = (await response.json().catch(() => ({}))) as { error?: string };
    setError(body.error ?? "Could not send the invitation");
    setStatus("error");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded border border-black/[.12] bg-black/[.02] p-4 dark:border-white/[.16] dark:bg-white/[.04]"
    >
      <div>
        <h3 className="text-sm font-semibold text-black dark:text-zinc-50">Invite your accountant</h3>
        <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
          Adviser seats are free — they never count toward your bill, however many you invite.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          required
          placeholder="them@theirfirm.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-w-0 flex-1 rounded border border-black/[.12] px-3 py-2 text-sm dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as MembershipRole)}
          className="rounded border border-black/[.12] px-2 py-2 text-sm dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
        >
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {status === "saving" ? "Sending…" : "Send invite"}
        </button>
      </div>
      {status === "done" && <p className="text-sm text-green-700 dark:text-green-400">Invitation sent.</p>}
      {status === "error" && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
