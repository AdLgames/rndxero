"use client";

import { useState } from "react";
import type { MembershipRole } from "@/lib/generated/prisma/client";
import { SegmentedControl } from "@/app/components/SegmentedControl";
import { Spinner } from "@/app/components/icons";
import { badgeAccent, badgeNeutral, buttonSecondary, fieldLabel, input } from "@/app/components/ui";

const ROLE_LABEL: Record<MembershipRole, string> = {
  OWNER: "Owner",
  FINANCE: "Finance",
  LEAD: "Lead",
  CONTRIBUTOR: "Member",
  ADVISER: "Adviser",
};

interface Seat {
  id: string;
  name: string;
  role: MembershipRole;
}

/** Inviting an adviser is free and prominent (BOARD-PLAN.md Phase 8.1) — the segmented control defaults to Adviser, not buried in a role list. */
export function InviteForm({ companyId, seats }: { companyId: string; seats: Seat[] }) {
  const [email, setEmail] = useState("");
  const [segment, setSegment] = useState<"ADVISER" | "MEMBER">("ADVISER");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError("");

    const role: MembershipRole = segment === "ADVISER" ? "ADVISER" : "CONTRIBUTOR";
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
    <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-6">
      <h5 className="m-0 mb-[6px] text-[15px] font-[600] tracking-[-0.02em] text-text">Invite your accountant</h5>
      <p className="m-0 mb-5 text-[13.5px] leading-[1.5] text-text-secondary">
        Adviser seats are free — they never count toward your bill, however many you invite.
      </p>
      <form onSubmit={handleSubmit}>
        <label className="mb-[14px] block">
          <span className={fieldLabel}>Email</span>
          <input type="email" required placeholder="them@theirfirm.com" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        </label>
        <SegmentedControl
          fullWidth
          className="mb-[18px]"
          segmentClassName="py-[7px]"
          options={[
            { value: "ADVISER", label: "Adviser" },
            { value: "MEMBER", label: "Member" },
          ]}
          value={segment}
          onChange={setSegment}
        />
        <button type="submit" disabled={status === "saving"} className={`${buttonSecondary} w-full`}>
          {status === "saving" && <Spinner />}
          {status === "saving" ? "Sending…" : "Send invite"}
        </button>
        {status === "done" && <p className="mt-2 text-[13px] font-[500] text-accent">Invitation sent.</p>}
        {status === "error" && <p className="mt-2 text-[13px] text-red-700">{error}</p>}
      </form>

      <div className="my-6 h-px bg-black/[.06]" />

      <div className="mb-[14px] text-[12.5px] text-text-tertiary">Seats</div>
      <div className="flex flex-col gap-[13px]">
        {seats.map((seat) => (
          <div key={seat.id} className="flex items-center justify-between text-[13.5px] text-text">
            <span>{seat.name}</span>
            <span className={seat.role === "ADVISER" ? badgeAccent : badgeNeutral}>{ROLE_LABEL[seat.role]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
