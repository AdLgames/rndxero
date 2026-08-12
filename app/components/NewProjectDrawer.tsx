"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { PlusIcon, XIcon } from "./icons";
import { buttonPrimary, fieldLabel, input } from "./ui";

export interface DrawerCompany {
  id: string;
  name: string;
}

/**
 * The single project-creation entry point, reachable from every screen
 * (rendered in SiteHeader) rather than a page-specific inline form.
 * Captures the HMRC technical baseline — uncertainty, baseline/advance
 * statement, competent professional lead — at the same moment as the
 * project itself, not as a separate step someone has to remember later.
 *
 * Portalled to document.body: SiteHeader's backdrop-blur makes it a CSS
 * containing block for position:fixed descendants (same rule as
 * transform/filter), so a plain nested `fixed inset-0` here would resolve
 * against the header bar's small box instead of the viewport — the drawer
 * would only ever show as a sliver behind the page instead of covering it.
 * No SSR guard needed for the portal target: `open` starts false and only
 * flips true from a click handler, so `document` is always defined by
 * the time this actually renders into it.
 */
export function NewProjectDrawer({ companies }: { companies: DrawerCompany[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [competentProfessionals, setCompetentProfessionals] = useState("");
  const [uncertaintyTitle, setUncertaintyTitle] = useState("");
  const [baseline, setBaseline] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  function reset() {
    setName("");
    setStartDate("");
    setCompetentProfessionals("");
    setUncertaintyTitle("");
    setBaseline("");
    setStatus("idle");
    setError("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("saving");
    setError("");

    try {
      const professionals = competentProfessionals
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);

      const projectResponse = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, name, startDate, competentProfessionals: professionals }),
      });
      if (!projectResponse.ok) {
        const body = (await projectResponse.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not create project");
      }
      const { project } = (await projectResponse.json()) as { project: { id: string } };

      if (uncertaintyTitle.trim() && baseline.trim()) {
        const uncertaintyResponse = await fetch("/api/capture/uncertainty", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, projectId: project.id, title: uncertaintyTitle.trim(), baseline: baseline.trim() }),
        });
        if (!uncertaintyResponse.ok) {
          const body = (await uncertaintyResponse.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Project was created, but the technical baseline could not be saved");
        }
      }

      reset();
      setOpen(false);
      router.push("/projects");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create project");
      setStatus("error");
    }
  }

  if (companies.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="New R&D project"
        className={`${buttonPrimary} shrink-0 px-[13px] sm:px-[18px]`}
      >
        <PlusIcon />
        <span className="hidden sm:inline">New R&amp;D project</span>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex justify-end">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/[.28] backdrop-blur-[2px]"
            />
            <div className="relative flex h-full w-full max-w-[440px] flex-col overflow-y-auto bg-white p-8 shadow-[-16px_0_40px_rgba(0,0,0,.12)]">
              <div className="mb-1 flex items-center justify-between">
                <h5 className="m-0 text-[19px] font-[640] tracking-[-0.02em] text-text">New R&amp;D project</h5>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-text-tertiary hover:text-text">
                  <XIcon />
                </button>
              </div>
              <p className="m-0 mb-6 text-[13.5px] leading-[1.5] text-text-secondary">
                Every project is a claimable line of R&amp;D — set the technical baseline now so it&apos;s on record from day one.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5">
                {companies.length > 1 && (
                  <label className="block">
                    <span className={fieldLabel}>Company</span>
                    <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={input}>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="block">
                  <span className={fieldLabel}>Project name</span>
                  <input type="text" required placeholder="Adaptive gripper control" value={name} onChange={(e) => setName(e.target.value)} className={input} />
                </label>

                <label className="block">
                  <span className={fieldLabel}>Start date</span>
                  <input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className={input} />
                </label>

                <label className="block">
                  <span className={fieldLabel}>Competent professional(s)</span>
                  <input
                    type="text"
                    required
                    placeholder="Ada Lovelace, Bo Chen"
                    value={competentProfessionals}
                    onChange={(e) => setCompetentProfessionals(e.target.value)}
                    className={input}
                  />
                  <p className="m-0 mt-[6px] text-[12.5px] text-text-quaternary">
                    The people whose judgement resolved the challenge. List the technical lead first.
                  </p>
                </label>

                <div className="border-t border-black/[.06] pt-5">
                  <p className="m-0 mb-1 text-[13px] font-[600] text-text">Technical baseline</p>
                  <p className="m-0 mb-4 text-[12.5px] leading-[1.5] text-text-quaternary">
                    Optional here — you can raise it later from Quick Capture instead. Recorded as this project&apos;s first
                    open challenge.
                  </p>

                  <label className="mb-4 block">
                    <span className={fieldLabel}>Scientific / technological challenge</span>
                    <input
                      type="text"
                      placeholder="What specific technical obstacle can't a competent professional readily resolve?"
                      value={uncertaintyTitle}
                      onChange={(e) => setUncertaintyTitle(e.target.value)}
                      className={input}
                    />
                  </label>

                  <label className="block">
                    <span className={fieldLabel}>Baseline &amp; advancement sought</span>
                    <textarea
                      rows={3}
                      placeholder="What's the existing state of knowledge, and what advance are you seeking beyond it?"
                      value={baseline}
                      onChange={(e) => setBaseline(e.target.value)}
                      className={input}
                    />
                  </label>
                </div>

                <div className="mt-auto flex items-center gap-3 pt-2">
                  <button type="submit" disabled={status === "saving"} className={`${buttonPrimary} flex-1`}>
                    {status === "saving" ? "Creating…" : "Create project"}
                  </button>
                </div>
                {status === "error" && <p className="m-0 text-[13px] text-red-700">{error}</p>}
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
