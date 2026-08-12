"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { badgeAccent, badgeNeutral } from "@/app/components/ui";
import { ArrowRightIcon } from "@/app/components/icons";

export interface RailProject {
  id: string;
  name: string;
  description: string | null;
  archived: boolean;
  ownerName: string | null;
  minutes: number;
}

export interface RailGroup {
  companyId: string;
  companyName: string;
  rows: RailProject[];
}

function hoursLabel(minutes: number): string {
  return `${(minutes / 60).toFixed(0)}h`;
}

/**
 * The persistent left rail for the Projects dashboard. Below lg, only one
 * of {rail, detail pane} can fit — this hides the rail once a specific
 * project is selected (pathname is /projects/[id]) and shows a "Back to
 * projects" affordance in the detail pane instead (see
 * [projectId]/page.tsx). Above lg both are always visible side by side.
 */
export function ProjectRail({ groups }: { groups: RailGroup[] }) {
  const pathname = usePathname();
  const onDetailPage = pathname !== "/projects";

  return (
    <div className={`flex-1 overflow-y-auto py-3 ${onDetailPage ? "hidden lg:block" : ""}`}>
      {groups.map((group) => (
        <div key={group.companyId} className="mb-2">
          {groups.length > 1 && <p className="px-6 py-2 text-[11px] font-[590] uppercase tracking-[.04em] text-text-quaternary">{group.companyName}</p>}
          <div className="flex flex-col gap-[3px] px-3">
            {group.rows.map((project) => {
              const active = pathname === `/projects/${project.id}`;
              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className={`rounded-[12px] px-[14px] py-[11px] transition-colors duration-150 ${active ? "bg-accent-tint" : "hover:bg-control-track"}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`truncate text-[13.5px] font-[600] tracking-[-0.01em] ${project.archived ? "text-text-secondary" : "text-text"}`}>{project.name}</span>
                    <span className={`shrink-0 text-[11px] ${active ? "text-accent" : "text-text-quaternary"}`}>{hoursLabel(project.minutes)}</span>
                  </div>
                  <div className="mt-[3px] flex items-center gap-[6px]">
                    <span className={project.archived ? badgeNeutral : badgeAccent}>{project.archived ? "Archived" : "Active"}</span>
                    {project.ownerName && <span className="truncate text-[11.5px] text-text-quaternary">{project.ownerName}</span>}
                  </div>
                  {project.description && <p className="m-0 mt-[5px] line-clamp-2 text-[11.5px] leading-[1.4] text-text-tertiary">{project.description}</p>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mobile-only — the detail pane's escape hatch back to the rail (see ProjectRail's own onDetailPage logic for why the rail hides itself instead of vice versa). */
export function BackToProjects() {
  return (
    <Link href="/projects" className="mb-5 inline-flex items-center gap-[6px] text-[13px] font-[590] text-text-secondary hover:text-text lg:hidden">
      <ArrowRightIcon className="rotate-180" />
      Back to projects
    </Link>
  );
}
