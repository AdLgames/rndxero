"use client";

import { useState } from "react";
import { Spinner } from "@/app/components/icons";
import { buttonPrimary, input } from "@/app/components/ui";
import type { GuidanceSource } from "@/lib/ai/assistant";

interface ChatEntry {
  role: "user" | "assistant";
  content: string;
  sources?: GuidanceSource[];
  isError?: boolean;
}

export function AiChatPanel({
  companyId,
  projectId,
  suggestedQueries,
}: {
  companyId: string;
  /** Scopes the question to one project's own evidence, in addition to HMRC guidance — omit for a company-wide question. */
  projectId?: string;
  suggestedQueries?: string[];
}) {
  const [question, setQuestion] = useState("");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "asking">("idle");

  async function ask(explicitQuestion?: string) {
    const trimmed = (explicitQuestion ?? question).trim();
    if (!trimmed || status === "asking") return;

    setEntries((prev) => [...prev, { role: "user", content: trimmed }]);
    setQuestion("");
    setStatus("asking");

    try {
      const response = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, projectId, question: trimmed }),
      });
      const body = (await response.json().catch(() => ({}))) as { answer?: string; sources?: GuidanceSource[]; error?: string };
      if (!response.ok || !body.answer) {
        setEntries((prev) => [...prev, { role: "assistant", content: body.error ?? "Something went wrong", isError: true }]);
        return;
      }
      setEntries((prev) => [...prev, { role: "assistant", content: body.answer!, sources: body.sources }]);
    } catch {
      setEntries((prev) => [...prev, { role: "assistant", content: "Could not reach the server", isError: true }]);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-6">
      <p className="m-0 mb-4 text-[12.5px] text-text-tertiary">
        Answers are drawn from HMRC&apos;s published guidance{projectId ? " and this project's own logged evidence" : ""}, with
        citations — not a determination of whether any project qualifies. Confirm anything decision-critical with your advisor.
      </p>

      {entries.length > 0 && (
        <div className="mb-4 flex flex-col gap-3">
          {entries.map((entry, i) => (
            <div
              key={i}
              className={
                entry.role === "user"
                  ? "ml-auto max-w-[85%] rounded-[12px] bg-accent px-[14px] py-[9px] text-[13.5px] text-white"
                  : `max-w-[95%] rounded-[12px] px-[14px] py-[10px] text-[13.5px] leading-[1.5] ${entry.isError ? "bg-red-50 text-red-700" : "bg-white text-text"}`
              }
            >
              <p className="m-0 whitespace-pre-wrap">{entry.content}</p>
              {entry.sources && entry.sources.length > 0 && (
                <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-[11.5px] text-text-tertiary">
                  {entry.sources.map((s, j) => (
                    <li key={j}>
                      <a href={s.sourceUrl} target="_blank" rel="noreferrer" className="text-accent hover:text-accent-hover">
                        {s.sourceTitle}
                        {s.heading ? ` — ${s.heading}` : ""}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {suggestedQueries && suggestedQueries.length > 0 && (
        <select
          value=""
          disabled={status === "asking"}
          onChange={(e) => {
            const chosen = e.target.value;
            if (chosen) ask(chosen);
          }}
          className={`${input} mb-[10px] cursor-pointer`}
        >
          <option value="">Suggested questions…</option>
          {suggestedQueries.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      )}

      <div className="flex items-center gap-3">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask();
            }
          }}
          placeholder="Ask a question…"
          className={input}
        />
        <button type="button" onClick={() => ask()} disabled={!question.trim() || status === "asking"} className={buttonPrimary}>
          {status === "asking" && <Spinner />}
          {status === "asking" ? "Asking…" : "Ask"}
        </button>
      </div>
    </div>
  );
}
