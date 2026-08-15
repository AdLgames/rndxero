"use client";

import { useState, type FormEvent } from "react";
import type { UncertaintyNoteType } from "@/lib/generated/prisma/client";
import { Spinner } from "@/app/components/icons";
import { buttonPrimary, chip, chipActive, fieldLabel, input } from "@/app/components/ui";

const TYPE_LABEL: Record<UncertaintyNoteType, string> = {
  NO_PROGRESS: "No progress",
  ATTEMPT: "Tried something",
  BLOCKER: "Blocker",
  FAILED_ATTEMPT: "Hit a wall",
  RESOLUTION: "Solved it",
};

const TYPE_FILTERS: Array<{ label: string; type: UncertaintyNoteType | null }> = [
  { label: "All", type: null },
  { label: "Hit a wall", type: "FAILED_ATTEMPT" },
  { label: "Solved it", type: "RESOLUTION" },
  { label: "Blockers", type: "BLOCKER" },
  { label: "Tried something", type: "ATTEMPT" },
  { label: "No progress", type: "NO_PROGRESS" },
];

interface NarrativeSearchResult {
  noteId: string;
  type: UncertaintyNoteType;
  body: string;
  evidenceRef: string | null;
  createdAt: string;
  weekKey: string;
  projectId: string;
  projectName: string;
  uncertaintyId: string;
  uncertaintyTitle: string;
  authorName: string | null;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function SearchClient({ companyId, projects }: { companyId: string; projects: Array<{ id: string; name: string }> }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<UncertaintyNoteType | null>(null);
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [results, setResults] = useState<NarrativeSearchResult[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  async function runSearch(e?: FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setStatus("loading");
    setErrorMessage("");
    try {
      const params = new URLSearchParams({ companyId, q: query.trim() });
      if (type) params.set("type", type);
      if (projectId) params.set("projectId", projectId);
      const response = await fetch(`/api/search/narrative?${params}`);
      if (!response.ok) {
        const responseBody = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(responseBody.error ?? "Search failed");
      }
      const { results: found } = (await response.json()) as { results: NarrativeSearchResult[] };
      setResults(found);
      setStatus("done");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Search failed");
      setStatus("error");
    }
  }

  return (
    <div>
      <form onSubmit={runSearch} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. authentication timeout, database migration…"
            className={`${input} flex-1`}
            autoFocus
          />
          {projects.length > 1 && (
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={input}>
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <button type="submit" disabled={status === "loading" || !query.trim()} className={buttonPrimary}>
            {status === "loading" && <Spinner />}
            {status === "loading" ? "Searching…" : "Search"}
          </button>
        </div>

        <div className="flex flex-wrap gap-[6px]">
          {TYPE_FILTERS.map((f) => (
            <button key={f.label} type="button" onClick={() => setType(f.type)} className={type === f.type ? chipActive : chip}>
              {f.label}
            </button>
          ))}
        </div>
      </form>

      {status === "error" && <p className="mt-4 text-sm text-red-700">{errorMessage}</p>}

      {status === "done" && (
        <div className="mt-7">
          <p className={`${fieldLabel} mb-3`}>
            {results.length} result{results.length === 1 ? "" : "s"}
          </p>
          {results.length === 0 && <p className="text-[13.5px] text-text-secondary">Nothing matched — try a shorter or different phrase.</p>}
          <div className="flex flex-col gap-3">
            {results.map((r) => (
              <div key={r.noteId} className="rounded-[14px] border border-black/[.06] bg-surface-sunken px-[22px] py-[18px]">
                <div className="mb-2 flex flex-wrap items-center gap-[8px]">
                  <a href={`/projects/${r.projectId}`} className="text-[13.5px] font-[600] text-text hover:text-accent">
                    {r.projectName}
                  </a>
                  <span className="text-text-quaternary">·</span>
                  <span className="text-[12.5px] text-text-tertiary">{r.uncertaintyTitle}</span>
                  <span className="ml-auto rounded-full bg-control-track px-[10px] py-[3px] text-[11px] font-[500] text-text-secondary">
                    {TYPE_LABEL[r.type]}
                  </span>
                </div>
                <p className="m-0 text-[14.5px] leading-[1.5] text-text">{r.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-[8px] text-[12px] text-text-quaternary">
                  <span>{r.authorName ?? "Unknown"}</span>
                  <span>·</span>
                  <span>Week {r.weekKey}</span>
                  <span>·</span>
                  <span>{fmtDate(r.createdAt)}</span>
                  {r.evidenceRef && (
                    <>
                      <span>·</span>
                      <span className="truncate text-accent">{r.evidenceRef}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
