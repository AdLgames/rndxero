"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Spinner } from "@/app/components/icons";
import { buttonPrimary, buttonSecondary, input } from "@/app/components/ui";
import type { GuidanceSource } from "@/lib/ai/assistant";

interface ChatEntry {
  role: "user" | "assistant";
  content: string;
  sources?: GuidanceSource[];
  isError?: boolean;
}

const MAX_VISIBLE_SUGGESTIONS = 8;

export function AiChatPanel({
  companyId,
  projectId,
  suggestedQueries,
  configured,
  canConfigure,
}: {
  companyId: string;
  /** Scopes the question to one project's own evidence, in addition to HMRC guidance — omit for a company-wide question. */
  projectId?: string;
  suggestedQueries?: string[];
  /** Whether the company has an AI provider set up at all — false renders an empty state instead of the chat UI. */
  configured: boolean;
  /** Whether the current user can reach /ai to set one up (Owner-only, per ai:configure). */
  canConfigure: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "asking">("idle");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const filteredSuggestions = useMemo(() => {
    if (!suggestedQueries) return [];
    const needle = question.trim().toLowerCase();
    const matches = needle ? suggestedQueries.filter((q) => q.toLowerCase().includes(needle)) : suggestedQueries;
    return matches.slice(0, MAX_VISIBLE_SUGGESTIONS);
  }, [suggestedQueries, question]);

  async function ask(explicitQuestion?: string) {
    const trimmed = (explicitQuestion ?? question).trim();
    if (!trimmed || status === "asking") return;

    setSuggestOpen(false);
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

  if (!configured) {
    return (
      <div className="rounded-[16px] border border-dashed border-black/[.14] bg-surface-sunken p-6 text-center">
        <p className="m-0 text-[13.5px] font-[590] text-text">AI Assistant not configured</p>
        <p className="m-0 mt-[6px] text-[13px] leading-[1.5] text-text-secondary">
          {canConfigure
            ? "Connect an AI provider to ask questions against HMRC guidance and this company's logged evidence."
            : "Ask a company Owner to connect an AI provider under AI Assistant settings before you can ask questions here."}
        </p>
        {canConfigure && (
          <Link href="/ai" className={`${buttonSecondary} mt-4 inline-flex`}>
            Set up AI Assistant
          </Link>
        )}
      </div>
    );
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

      <div className="relative flex items-center gap-3">
        <input
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            setHighlight(0);
            if (suggestedQueries && suggestedQueries.length > 0) setSuggestOpen(true);
          }}
          onFocus={() => {
            clearTimeout(blurTimeout.current);
            if (suggestedQueries && suggestedQueries.length > 0) setSuggestOpen(true);
          }}
          onBlur={() => {
            // Let a click on a suggestion register before the list disappears.
            blurTimeout.current = setTimeout(() => setSuggestOpen(false), 120);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setSuggestOpen(false);
              return;
            }
            if (suggestOpen && filteredSuggestions.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              e.preventDefault();
              const delta = e.key === "ArrowDown" ? 1 : -1;
              setHighlight((h) => (h + delta + filteredSuggestions.length) % filteredSuggestions.length);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (suggestOpen && filteredSuggestions.length > 0) {
                ask(filteredSuggestions[highlight]);
              } else {
                ask();
              }
            }
          }}
          placeholder="Ask a question, or pick a suggestion below…"
          className={input}
        />
        <button type="button" onClick={() => ask()} disabled={!question.trim() || status === "asking"} className={buttonPrimary}>
          {status === "asking" && <Spinner />}
          {status === "asking" ? "Asking…" : "Ask"}
        </button>

        {suggestOpen && filteredSuggestions.length > 0 && (
          <div className="absolute left-0 right-[92px] top-[calc(100%+6px)] z-10 max-h-[240px] overflow-y-auto rounded-[12px] border border-black/[.08] bg-white py-[6px] shadow-[0_8px_24px_rgba(0,0,0,.10)]">
            {filteredSuggestions.map((q, i) => (
              <button
                key={q}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(i)}
                onClick={() => ask(q)}
                className={`block w-full px-[14px] py-[9px] text-left text-[13px] leading-[1.4] transition-colors duration-100 ${
                  i === highlight ? "bg-control-track text-text" : "text-text-tertiary"
                }`}
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
