"use client";

import { useState } from "react";
import { Panel } from "@/app/components/Panel";
import { buttonPrimary, buttonSecondary, eyebrow } from "@/app/components/ui";

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
          className="min-w-0 flex-1 border border-steel/40 bg-white px-2 py-1 text-sm text-foreground"
        />
        <button type="button" disabled={status === "saving"} onClick={submit} className={`${buttonPrimary} px-3 py-1 text-xs`}>
          Link repo
        </button>
      </div>
      {status === "error" && <p className="text-xs text-red-700">{error}</p>}
      <p className="text-xs text-foreground/50">
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
    <Panel as="li" className="p-3 text-sm">
      <p className="text-foreground">{suggestion.summary}</p>
      <p className="mt-0.5 text-xs text-foreground/50">{suggestion.externalRef}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          value={uncertaintyId}
          onChange={(e) => setUncertaintyId(e.target.value)}
          className="border border-steel/40 bg-white px-2 py-1 text-xs text-foreground"
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
          className="w-24 border border-steel/40 bg-white px-2 py-1 text-xs text-foreground"
        />
        <button type="button" disabled={busy || !uncertaintyId} onClick={confirm} className={`${buttonPrimary} px-2 py-1 text-xs`}>
          Confirm
        </button>
        <button type="button" disabled={busy} onClick={dismiss} className={`${buttonSecondary} px-2 py-1 text-xs`}>
          Dismiss
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </Panel>
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
        <Panel key={project.projectId} as="section" className="p-4">
          <h2 className="text-base font-bold text-foreground">{project.projectName}</h2>

          {project.canManageRepos && (
            <div className="mt-3">
              {project.repoLinks.length > 0 && (
                <ul className="mb-2 flex flex-col gap-1 text-xs text-foreground/60">
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
            <div className="mt-4 border-t border-steel/20 pt-3">
              <p className={eyebrow}>Pending suggestions ({project.suggestions.length})</p>
              <ul className="mt-2 flex flex-col gap-2">
                {project.suggestions.map((s) => (
                  <SuggestionRow key={s.id} suggestion={s} project={project} currentWeekKey={currentWeekKey} onResolved={(id) => resolveSuggestion(project.projectId, id)} />
                ))}
                {project.suggestions.length === 0 && <li className="text-xs text-foreground/50">Nothing pending.</li>}
              </ul>
            </div>
          )}
        </Panel>
      ))}
    </div>
  );
}
