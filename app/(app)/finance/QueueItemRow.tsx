"use client";

import { useState } from "react";
import type { ApprovalTargetType } from "@/lib/generated/prisma/client";

export function QueueItemRow({
  companyId,
  targetType,
  targetId,
  projectName,
  summary,
}: {
  companyId: string;
  targetType: ApprovalTargetType;
  targetId: string;
  projectName: string;
  summary: string;
}) {
  const [state, setState] = useState<"pending" | "approved" | "queried" | "saving">("pending");

  async function decide(action: "approve" | "query") {
    setState("saving");
    const comment = action === "query" ? window.prompt("What needs clarifying?") ?? "" : undefined;
    const response = await fetch("/api/approvals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, targetType, targetId, action, comment }),
    });
    setState(response.ok ? (action === "approve" ? "approved" : "queried") : "pending");
  }

  if (state === "approved" || state === "queried") {
    return (
      <li className="flex items-center justify-between border-b border-black/[.08] py-3 text-sm text-zinc-500 dark:border-white/[.08]">
        <span>
          {projectName} — {summary}
        </span>
        <span>{state === "approved" ? "✓ Approved" : "? Queried"}</span>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between border-b border-black/[.08] py-3 text-sm dark:border-white/[.08]">
      <span className="text-black dark:text-zinc-50">
        {projectName} — {summary}
      </span>
      <span className="flex gap-2">
        <button
          onClick={() => decide("approve")}
          disabled={state === "saving"}
          className="rounded bg-foreground px-3 py-1 text-xs font-medium text-background hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          Approve
        </button>
        <button
          onClick={() => decide("query")}
          disabled={state === "saving"}
          className="rounded border border-black/[.12] px-3 py-1 text-xs font-medium text-black hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-white/[.08]"
        >
          Query
        </button>
      </span>
    </li>
  );
}
