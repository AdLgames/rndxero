"use client";

import { useState } from "react";
import type { MembershipRole } from "@/lib/generated/prisma/client";
import { buttonPrimary, eyebrow, input, select } from "@/app/components/ui";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border border-sage/50 bg-sage/5 p-4">
      <div>
        <h3 className={eyebrow}>Invite your accountant</h3>
        <p className="mt-0.5 text-xs text-foreground/60">
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
          className={`min-w-0 flex-1 ${input.replace("mt-1 ", "")}`}
        />
        <select value={role} onChange={(e) => setRole(e.target.value as MembershipRole)} className={select}>
          {ROLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={status === "saving"} className={buttonPrimary}>
          {status === "saving" ? "Sending…" : "Send invite"}
        </button>
      </div>
      {status === "done" && <p className="text-sm font-semibold text-sage-dark">Invitation sent.</p>}
      {status === "error" && <p className="text-sm text-red-700">{error}</p>}
    </form>
  );
}
