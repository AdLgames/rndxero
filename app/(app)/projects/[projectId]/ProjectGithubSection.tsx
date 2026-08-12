"use client";

import { useState } from "react";
import { Spinner } from "@/app/components/icons";
import { badgeNeutral, buttonPrimary, eyebrow, input } from "@/app/components/ui";

export interface ProjectGithubData {
  projectId: string;
  companyId: string;
  canManageRepos: boolean;
  canReviewSuggestions: boolean;
  repoLinks: Array<{ id: string; repoFullName: string; webhookSecret: string }>;
  suggestions: Array<{ id: string; summary: string; externalRef: string }>;
  challenges: Array<{ id: string; title: string }>;
  webhookUrl: string;
  currentWeekKey: string;
}

function RepoLinkForm({
  data,
  onLinked,
}: {
  data: ProjectGithubData;
  onLinked: (link: { id: string; repoFullName: string; webhookSecret: string }) => void;
}) {
  const [repoFullName, setRepoFullName] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  async function submit() {
    if (!repoFullName.trim()) return;
    setStatus("saving");
    setError("");
    const response = await fetch("/api/github/repo-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: data.companyId, projectId: data.projectId, repoFullName: repoFullName.trim() }),
    });
    const body = (await response.json().catch(() => ({}))) as { repoLink?: { id: string; repoFullName: string; webhookSecret: string }; error?: string };
    if (!response.ok || !body.repoLink) {
      setError(body.error ?? "Could not link that repo");
      setStatus("error");
      return;
    }
    onLinked(body.repoLink);
    setRepoFullName("");
    setStatus("idle");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <input type="text" placeholder="owner/repo" value={repoFullName} onChange={(e) => setRepoFullName(e.target.value)} className={`${input} flex-1`} />
        <button type="button" disabled={status === "saving"} onClick={submit} className={buttonPrimary}>
          {status === "saving" && <Spinner />}
          {status === "saving" ? "Linking…" : "Link repo"}
        </button>
      </div>
      {status === "error" && <p className="m-0 text-[13px] text-red-700">{error}</p>}
      <p className="m-0 text-[12.5px] text-text-quaternary">
        Webhook URL for GitHub&apos;s repo settings: <code className="break-all text-text-tertiary">{data.webhookUrl}</code>
      </p>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  data,
  onResolved,
}: {
  suggestion: ProjectGithubData["suggestions"][number];
  data: ProjectGithubData;
  onResolved: (id: string) => void;
}) {
  const [challengeId, setChallengeId] = useState(data.challenges[0]?.id ?? "");
  const [weekKey, setWeekKey] = useState(data.currentWeekKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (!challengeId) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/github/suggestions/${suggestion.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: data.companyId, projectId: data.projectId, weekKey, uncertaintyId: challengeId }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not confirm");
      setBusy(false);
      return;
    }
    onResolved(suggestion.id);
  }

  async function dismiss() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/github/suggestions/${suggestion.id}/dismiss`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: data.companyId, projectId: data.projectId }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not dismiss");
      setBusy(false);
      return;
    }
    onResolved(suggestion.id);
  }

  return (
    <li className="rounded-[14px] border border-black/[.06] bg-white p-[14px]">
      <p className="m-0 text-[13.5px] text-text">{suggestion.summary}</p>
      <p className="m-0 mt-[3px] text-[12px] text-text-quaternary">{suggestion.externalRef}</p>

      <div className="mt-[10px] flex flex-wrap items-center gap-2">
        <select
          value={challengeId}
          onChange={(e) => setChallengeId(e.target.value)}
          className="rounded-[8px] border border-black/[.11] bg-white px-2 py-[6px] text-[12.5px] text-text outline-none"
        >
          {data.challenges.length === 0 && <option value="">No open challenges</option>}
          {data.challenges.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={weekKey}
          onChange={(e) => setWeekKey(e.target.value)}
          className="w-[92px] rounded-[8px] border border-black/[.11] bg-white px-2 py-[6px] text-[12.5px] text-text outline-none"
        />
        <button
          type="button"
          disabled={busy || !challengeId}
          onClick={confirm}
          className="flex items-center gap-[5px] rounded-[8px] bg-accent px-3 py-[6px] text-[12.5px] font-[590] text-white transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
        >
          {busy && <Spinner />}
          Confirm
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={dismiss}
          className="flex items-center gap-[5px] rounded-[8px] border border-black/[.11] bg-white px-3 py-[6px] text-[12.5px] font-[590] text-text transition-colors duration-150 hover:bg-[#FAFAFA] disabled:opacity-50"
        >
          {busy && <Spinner />}
          Dismiss
        </button>
      </div>
      {error && <p className="m-0 mt-[6px] text-[12.5px] text-red-700">{error}</p>}
    </li>
  );
}

/**
 * GitHub used to be its own top-level tab; it's now a section on the
 * project it belongs to (commits only ever mean anything in the context
 * of one project's evidence) rather than a place you browse across every
 * project at once.
 */
export function ProjectGithubSection({ data: initialData }: { data: ProjectGithubData }) {
  const [data, setData] = useState(initialData);

  if (!data.canManageRepos && !data.canReviewSuggestions) return null;

  function addRepoLink(link: { id: string; repoFullName: string; webhookSecret: string }) {
    setData((prev) => ({ ...prev, repoLinks: [...prev.repoLinks, link] }));
  }

  function resolveSuggestion(suggestionId: string) {
    setData((prev) => ({ ...prev, suggestions: prev.suggestions.filter((s) => s.id !== suggestionId) }));
  }

  return (
    <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-6">
      {data.canManageRepos && (
        <div>
          {data.repoLinks.length > 0 && (
            <ul className="m-0 mb-3 flex list-none flex-col gap-1 p-0 text-[12.5px] text-text-tertiary">
              {data.repoLinks.map((link) => (
                <li key={link.id}>
                  {link.repoFullName} — secret: <code className="break-all">{link.webhookSecret}</code>
                </li>
              ))}
            </ul>
          )}
          <RepoLinkForm data={data} onLinked={addRepoLink} />
        </div>
      )}

      {data.canReviewSuggestions && (
        <div className={data.canManageRepos ? "mt-5 border-t border-black/[.055] pt-4" : ""}>
          <p className={eyebrow}>
            Pending suggestions <span className={`${badgeNeutral} ml-1`}>{data.suggestions.length}</span>
          </p>
          <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
            {data.suggestions.map((s) => (
              <SuggestionRow key={s.id} suggestion={s} data={data} onResolved={resolveSuggestion} />
            ))}
            {data.suggestions.length === 0 && <li className="text-[13px] text-text-quaternary">Nothing pending.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
