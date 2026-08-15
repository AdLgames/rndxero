"use client";

import { useMemo, useState, type DragEvent } from "react";
import Link from "next/link";
import type { ProjectStatus, QualificationStatus } from "@/lib/generated/prisma/client";
import type { PortfolioCard } from "@/lib/board/portfolio";
import { badgeNeutral, input } from "@/app/components/ui";

const STATUS_ORDER: ProjectStatus[] = ["PLANNED", "ACTIVE", "PAUSED", "COMPLETED", "ABANDONED"];

const STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  ABANDONED: "Abandoned",
};

/** Left-border accent per qualification tag — same green/red/grey vocabulary used everywhere else in Trace, not a second colour system. */
const QUALIFICATION_COLOR: Record<QualificationStatus, string> = {
  QUALIFYING: "#0E7A58",
  NON_QUALIFYING: "#C0392B",
  UNDECIDED: "#D8D8DC",
};

const QUALIFICATION_LABEL: Record<QualificationStatus, string> = {
  QUALIFYING: "Qualifying",
  NON_QUALIFYING: "Non-qualifying",
  UNDECIDED: "Undecided",
};

const COMPACT_CARDS_PER_COLUMN = 4;

function hoursLabel(minutes: number): string {
  const h = minutes / 60;
  return Number.isInteger(h) ? h.toString() : h.toFixed(1);
}

function Card({ card, draggable, onDragStart }: { card: PortfolioCard; draggable: boolean; onDragStart: (e: DragEvent<HTMLDivElement>) => void }) {
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      className={`rounded-[10px] border border-black/[.06] bg-white p-[12px] shadow-[0_1px_2px_rgba(0,0,0,.04)] transition-shadow duration-150 hover:shadow-[0_2px_8px_rgba(0,0,0,.08)] ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
      style={{ borderLeft: `3px solid ${QUALIFICATION_COLOR[card.qualificationStatus]}` }}
    >
      <Link href={`/projects/${card.projectId}`} className="block">
        <p className="m-0 text-[13px] font-[600] leading-[1.3] tracking-[-0.01em] text-text hover:text-accent">{card.projectName}</p>
      </Link>
      <p className="m-0 mt-[3px] text-[11.5px] text-text-quaternary">{card.ownerName ?? "Unassigned"}</p>

      <div className="mt-[10px] flex items-center justify-between border-t border-black/[.05] pt-[8px] text-[11px] text-text-tertiary">
        <span>
          Logged <span className="font-[590] text-text-secondary">{hoursLabel(card.loggedMinutes)}h</span>
        </span>
        <span>
          Planned <span className="font-[590] text-text-secondary">{hoursLabel(card.plannedMinutes)}h</span>
        </span>
      </div>

      {card.openChallengeCount > 0 && (
        <span className="mt-[8px] inline-flex items-center gap-[4px] rounded-full bg-control-track px-[8px] py-[2px] text-[10.5px] font-[500] text-text-tertiary">
          {card.openChallengeCount} open challenge{card.openChallengeCount === 1 ? "" : "s"}
        </span>
      )}
    </div>
  );
}

function Column({
  status,
  cards,
  editableByProject,
  compact,
  onDrop,
}: {
  status: ProjectStatus;
  cards: PortfolioCard[];
  editableByProject: Record<string, boolean>;
  compact: boolean;
  onDrop: (projectId: string, status: ProjectStatus) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const columnAcceptsDrops = !compact;
  const totalLoggedMinutes = cards.reduce((sum, c) => sum + c.loggedMinutes, 0);
  const visibleCards = compact ? cards.slice(0, COMPACT_CARDS_PER_COLUMN) : cards;
  const hiddenCount = cards.length - visibleCards.length;

  return (
    <div
      className={`flex w-[248px] shrink-0 flex-col rounded-[14px] transition-colors duration-100 ${dragOver ? "bg-accent-wash" : "bg-surface-sunken"}`}
      onDragOver={(e) => {
        if (!columnAcceptsDrops) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false);
        if (!columnAcceptsDrops) return;
        const projectId = e.dataTransfer.getData("text/plain");
        if (projectId) onDrop(projectId, status);
      }}
    >
      <div className="flex items-center justify-between px-[14px] pb-[8px] pt-[14px]">
        <span className="text-[11.5px] font-[650] uppercase tracking-[.04em] text-text-secondary">{STATUS_LABEL[status]}</span>
        <span className="rounded-full bg-control-track px-[8px] py-[2px] text-[11px] font-[590] text-text-tertiary">{cards.length}</span>
      </div>

      <div className={`flex flex-col gap-[8px] px-[10px] pb-[10px] ${compact ? "" : "max-h-[calc(100vh-360px)] overflow-y-auto"}`}>
        {visibleCards.map((card) => (
          <Card
            key={card.projectId}
            card={card}
            draggable={!compact && (editableByProject[card.projectId] ?? false)}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", card.projectId);
              e.dataTransfer.effectAllowed = "move";
            }}
          />
        ))}
        {cards.length === 0 && <p className="m-0 px-[4px] py-[6px] text-[12px] text-text-quaternary">Nothing here</p>}
        {hiddenCount > 0 && <p className="m-0 px-[4px] text-[11.5px] text-text-quaternary">+{hiddenCount} more</p>}
      </div>

      {!compact && cards.length > 0 && (
        <div className="mt-auto border-t border-black/[.055] px-[14px] py-[9px] text-[11px] text-text-tertiary">
          Total logged <span className="font-[590] text-text-secondary">{hoursLabel(totalLoggedMinutes)}h</span>
        </div>
      )}
    </div>
  );
}

/**
 * The portfolio board — one card per project, grouped into columns by
 * ProjectStatus (its phase-gate stage), replacing the old per-week
 * evidence lanes. The weekly detail that view showed still lives on each
 * project's own page (its calendar planner) — this is a higher-altitude
 * "where does everything stand" view, styled after a phase-gate kanban
 * (columns as stages, draggable cards, a colour-coded left border).
 */
export function BoardClient({
  companyId,
  cards: initialCards,
  editableByProject,
  compact = false,
}: {
  companyId: string;
  cards: PortfolioCard[];
  /** Which projects the current user can drag between columns — mirrors project:update, same as the project detail page's edit gate. */
  editableByProject: Record<string, boolean>;
  /** Home's embed: no search, no drag-and-drop, a capped card count per column, and a link to the full board. */
  compact?: boolean;
}) {
  const [cards, setCards] = useState(initialCards);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const filteredCards = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return cards;
    return cards.filter((c) => c.projectName.toLowerCase().includes(needle));
  }, [cards, search]);

  const cardsByStatus = useMemo(() => {
    const map = new Map<ProjectStatus, PortfolioCard[]>(STATUS_ORDER.map((s) => [s, []]));
    for (const card of filteredCards) {
      map.get(card.status)?.push(card);
    }
    return map;
  }, [filteredCards]);

  async function moveProject(projectId: string, status: ProjectStatus) {
    const card = cards.find((c) => c.projectId === projectId);
    if (!card || card.status === status || !editableByProject[projectId]) return;

    const previousStatus = card.status;
    setCards((prev) => prev.map((c) => (c.projectId === projectId ? { ...c, status } : c)));
    setError("");

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, status }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not move this project");
      }
    } catch (e) {
      setCards((prev) => prev.map((c) => (c.projectId === projectId ? { ...c, status: previousStatus } : c)));
      setError(e instanceof Error ? e.message : "Could not move this project");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className={`${input} max-w-[280px]`}
          />
          <div className="flex flex-wrap items-center gap-[16px] text-[12px] text-text-tertiary">
            <span>Qualification tag</span>
            {(["QUALIFYING", "UNDECIDED", "NON_QUALIFYING"] as QualificationStatus[]).map((q) => (
              <span key={q} className="flex items-center gap-[6px]">
                <span className="h-[10px] w-[3px] rounded-[2px]" style={{ background: QUALIFICATION_COLOR[q] }} />
                {QUALIFICATION_LABEL[q]}
              </span>
            ))}
          </div>
        </div>
      )}

      {error && <p className="m-0 text-[13px] text-red-700">{error}</p>}

      <div className="flex gap-[12px] overflow-x-auto pb-[6px]">
        {STATUS_ORDER.map((status) => (
          <Column
            key={status}
            status={status}
            cards={cardsByStatus.get(status) ?? []}
            editableByProject={editableByProject}
            compact={compact}
            onDrop={moveProject}
          />
        ))}
      </div>

      {compact && (
        <Link href="/board" className={`self-start ${badgeNeutral} hover:text-text`}>
          View full board →
        </Link>
      )}
    </div>
  );
}
