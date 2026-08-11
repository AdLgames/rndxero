"use client";

import { useState } from "react";

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

function RepoLinkForm({ project, webhookUrl, onLinked }: { project: ProjectGithubData; webhookUrl: string; onLinked: (link: { id: string; repoFullName: string; webhookSecret: string }) => void }) {
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
        <input
          type="text"
          placeholder="owner/repo"
          value={repoFullName}
          onChange={(e) => setRepoFullName(e.target.value)}
          className="min-w-0 flex-1 rounded border border-black/[.12] px-2 py-1 text-sm dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
        />
        <button
          type="button"
          disabled={status === "saving"}
          onClick={submit}
          className="rounded bg-foreground px-3 py-1 text-xs font-medium text-background disabled:opacity-50"
        >
          Link repo
        </button>
      </div>
      {status === "error" && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Webhook URL for GitHub&apos;s repo settings: <code className="break-all">{webhookUrl}</code>
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
    <li className="rounded border border-black/[.08] p-3 text-sm dark:border-white/[.08]">
      <p className="text-black dark:text-zinc-50">{suggestion.summary}</p>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{suggestion.externalRef}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={uncertaintyId}
          onChange={(e) => setUncertaintyId(e.target.value)}
          className="rounded border border-black/[.12] px-2 py-1 text-xs dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
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
          className="w-24 rounded border border-black/[.12] px-2 py-1 text-xs dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
        />
        <button
          type="button"
          disabled={busy || !uncertaintyId}
          onClick={confirm}
          className="rounded bg-foreground px-2 py-1 text-xs font-medium text-background disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={dismiss}
          className="rounded border border-black/[.12] px-2 py-1 text-xs dark:border-white/[.145] dark:text-zinc-50"
        >
          Dismiss
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
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
    <div className="flex flex-col gap-6">
      {projects.map((project) => (
        <section key={project.projectId} className="rounded border border-black/[.08] p-4 dark:border-white/[.08]">
          <h2 className="text-base font-medium text-black dark:text-zinc-50">{project.projectName}</h2>

          {project.canManageRepos && (
            <div className="mt-3">
              {project.repoLinks.length > 0 && (
                <ul className="mb-2 flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
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
            <div className="mt-4 border-t border-black/[.06] pt-3 dark:border-white/[.06]">
              <h3 className="text-sm font-medium text-black dark:text-zinc-50">Pending suggestions ({project.suggestions.length})</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {project.suggestions.map((s) => (
                  <SuggestionRow
                    key={s.id}
                    suggestion={s}
                    project={project}
                    currentWeekKey={currentWeekKey}
                    onResolved={(id) => resolveSuggestion(project.projectId, id)}
                  />
                ))}
                {project.suggestions.length === 0 && <li className="text-xs text-zinc-500 dark:text-zinc-400">Nothing pending.</li>}
              </ul>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
