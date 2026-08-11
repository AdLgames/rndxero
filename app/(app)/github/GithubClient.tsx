"use client";

import { useState } from "react";
import { badgeNeutral, buttonPrimary, eyebrow, input } from "@/app/components/ui";

export interface ProjectGithubData {
  projectId: string;
  projectName: string;
  companyId: string;
  canManageRepos: boolean;
  canReviewSuggestions: boolean;
  repoLinks: Array<{ id: string; repoFullName: string; webhookSecret: string }>;
  suggestions: Array<{ id: string; summary: string; externalRef: string }>;
  uncertainties: Array<{ id: string; title: string }>;
}

function RepoLinkForm({
  project,
  webhookUrl,
  onLinked,
}: {
  project: ProjectGithubData;
  webhookUrl: string;
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
      body: JSON.stringify({ companyId: project.companyId, projectId: project.projectId, repoFullName: repoFullName.trim() }),
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
      <div className="flex gap-2">
        <input type="text" placeholder="owner/repo" value={repoFullName} onChange={(e) => setRepoFullName(e.target.value)} className={`${input} flex-1`} />
        <button type="button" disabled={status === "saving"} onClick={submit} className={buttonPrimary}>
          {status === "saving" ? "Linking…" : "Link repo"}
        </button>
      </div>
      {status === "error" && <p className="m-0 text-[13px] text-red-700">{error}</p>}
      <p className="m-0 text-[12.5px] text-text-quaternary">
        Webhook URL for GitHub&apos;s repo settings: <code className="break-all text-text-tertiary">{webhookUrl}</code>
      </p>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  project,
  currentWeekKey,
  onResolved,
}: {
  suggestion: ProjectGithubData["suggestions"][number];
  project: ProjectGithubData;
  currentWeekKey: string;
  onResolved: (id: string) => void;
}) {
  const [uncertaintyId, setUncertaintyId] = useState(project.uncertainties[0]?.id ?? "");
  const [weekKey, setWeekKey] = useState(currentWeekKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (!uncertaintyId) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/github/suggestions/${suggestion.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: project.companyId, projectId: project.projectId, weekKey, uncertaintyId }),
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
      body: JSON.stringify({ companyId: project.companyId, projectId: project.projectId }),
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
          value={uncertaintyId}
          onChange={(e) => setUncertaintyId(e.target.value)}
          className="rounded-[8px] border border-black/[.11] bg-white px-2 py-[6px] text-[12.5px] text-text outline-none"
        >
          {project.uncertainties.length === 0 && <option value="">No open uncertainties</option>}
          {project.uncertainties.map((u) => (
            <option key={u.id} value={u.id}>
              {u.title}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={weekKey}
          onChange={(e) => setWeekKey(e.target.value)}
          className="w-[92px] rounded-[8px] border border-black/[.11] bg-white px-2 py-[6px] text-[12.5px] text-text outline-none"
        />
        <button type="button" disabled={busy || !uncertaintyId} onClick={confirm} className="rounded-[8px] bg-accent px-3 py-[6px] text-[12.5px] font-[590] text-white transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50">
          Confirm
        </button>
        <button type="button" disabled={busy} onClick={dismiss} className="rounded-[8px] border border-black/[.11] bg-white px-3 py-[6px] text-[12.5px] font-[590] text-text transition-colors duration-150 hover:bg-[#FAFAFA] disabled:opacity-50">
          Dismiss
        </button>
      </div>
      {error && <p className="m-0 mt-[6px] text-[12.5px] text-red-700">{error}</p>}
    </li>
  );
}

export function GithubClient({
  projects: initialProjects,
  webhookUrl,
  currentWeekKey,
}: {
  projects: ProjectGithubData[];
  webhookUrl: string;
  currentWeekKey: string;
}) {
  const [projects, setProjects] = useState(initialProjects);

  function addRepoLink(projectId: string, link: { id: string; repoFullName: string; webhookSecret: string }) {
    setProjects((prev) => prev.map((p) => (p.projectId === projectId ? { ...p, repoLinks: [...p.repoLinks, link] } : p)));
  }

  function resolveSuggestion(projectId: string, suggestionId: string) {
    setProjects((prev) =>
      prev.map((p) => (p.projectId === projectId ? { ...p, suggestions: p.suggestions.filter((s) => s.id !== suggestionId) } : p))
    );
  }

  return (
    <div className="flex flex-col gap-[14px]">
      {projects.map((project) => (
        <section key={project.projectId} className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-6">
          <h4 className="m-0 mb-4 text-[16.5px] font-[600] tracking-[-0.02em] text-text">{project.projectName}</h4>

          {project.canManageRepos && (
            <div>
              {project.repoLinks.length > 0 && (
                <ul className="m-0 mb-3 flex list-none flex-col gap-1 p-0 text-[12.5px] text-text-tertiary">
                  {project.repoLinks.map((link) => (
                    <li key={link.id}>
                      {link.repoFullName} — secret: <code className="break-all">{link.webhookSecret}</code>
                    </li>
                  ))}
                </ul>
              )}
              <RepoLinkForm project={project} webhookUrl={webhookUrl} onLinked={(link) => addRepoLink(project.projectId, link)} />
            </div>
          )}

          {project.canReviewSuggestions && (
            <div className="mt-5 border-t border-black/[.055] pt-4">
              <p className={eyebrow}>
                Pending suggestions <span className={`${badgeNeutral} ml-1`}>{project.suggestions.length}</span>
              </p>
              <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                {project.suggestions.map((s) => (
                  <SuggestionRow key={s.id} suggestion={s} project={project} currentWeekKey={currentWeekKey} onResolved={(id) => resolveSuggestion(project.projectId, id)} />
                ))}
                {project.suggestions.length === 0 && <li className="text-[13px] text-text-quaternary">Nothing pending.</li>}
              </ul>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
