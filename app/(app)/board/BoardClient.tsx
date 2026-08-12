"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { UncertaintyNoteType } from "@/lib/generated/prisma/client";
import { getIsoWeekKey } from "@/lib/capture/week-key";
import type { BoardData, BoardNote } from "@/lib/board/repository";

export interface LaneUncertaintyOption {
  id: string;
  title: string;
}

/**
 * One accent, five steps — the board's progress ramp encodes state as
 * opacity rather than a second hue (design handoff, "Board" section).
 * Colour alone isn't enough for colour-blind users or screen readers, so
 * every bar also carries a full text label surfaced as both a visible
 * tooltip and an aria-label.
 */
const TYPE_STYLE: Record<UncertaintyNoteType, { ramp: string; label: string }> = {
  NO_PROGRESS: { ramp: "#D8D8DC", label: "No progress" },
  ATTEMPT: { ramp: "rgba(14,122,88,.38)", label: "Tried something" },
  BLOCKER: { ramp: "rgba(14,122,88,.58)", label: "Blocker" },
  FAILED_ATTEMPT: { ramp: "rgba(14,122,88,.78)", label: "Hit a wall" },
  RESOLUTION: { ramp: "#0E7A58", label: "Solved it" },
};

const TYPE_PRIORITY: UncertaintyNoteType[] = ["FAILED_ATTEMPT", "BLOCKER", "RESOLUTION", "ATTEMPT", "NO_PROGRESS"];

function dominantType(notes: BoardNote[]): UncertaintyNoteType | null {
  for (const type of TYPE_PRIORITY) {
    if (notes.some((n) => n.type === type)) return type;
  }
  return null;
}

function hoursLabel(minutes: number): string {
  const h = minutes / 60;
  return Number.isInteger(h) ? h.toString() : h.toFixed(1);
}

/** 34h fills the 104px plot; anything above clamps to full height rather than overflowing. */
function barHeight(minutes: number): number {
  const hours = Math.min(minutes / 60, 34);
  return Math.round((hours / 34) * 104);
}

function NoteDetail({
  note,
  companyId,
  projectId,
  canRemap,
  uncertainties,
  onRemapped,
}: {
  note: BoardNote;
  companyId: string;
  projectId: string;
  canRemap: boolean;
  uncertainties: LaneUncertaintyOption[];
  onRemapped: () => void;
}) {
  const [target, setTarget] = useState(note.uncertaintyId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function move() {
    if (target === note.uncertaintyId) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/board/remap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, projectId, noteId: note.id, toUncertaintyId: target }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not move this note");
      }
      onRemapped();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not move this note");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[10px] border border-black/[.06] bg-surface-sunken p-[10px] text-left">
      <p className="m-0 text-[11px] font-[590] text-text-tertiary">
        {TYPE_STYLE[note.type].label} {note.locked ? "· sealed" : ""}
      </p>
      <p className="m-0 mt-[3px] text-[12.5px] text-text-secondary">{note.uncertaintyTitle}</p>
      <p className="m-0 mt-1 text-[13px] leading-[1.4] text-text">{note.bodyPreview}</p>

      {canRemap && !note.locked && (
        <div className="mt-2 flex items-center gap-[6px] border-t border-black/[.06] pt-2">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="min-w-0 flex-1 rounded-[7px] border border-black/[.11] bg-white px-[7px] py-1 text-[12px] text-text outline-none"
          >
            {uncertainties.map((u) => (
              <option key={u.id} value={u.id}>
                {u.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || target === note.uncertaintyId}
            onClick={move}
            className="shrink-0 rounded-[7px] bg-accent px-[9px] py-1 text-[12px] font-[590] text-white transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
          >
            {busy ? "Moving…" : "Move"}
          </button>
        </div>
      )}
      {error && <p className="m-0 mt-1 text-[12px] text-red-700">{error}</p>}
    </div>
  );
}

function WeekColumn({
  weekKey,
  isCurrentWeek,
  plannedMinutes,
  actualMinutes,
  notes,
  companyId,
  projectId,
  canRemap,
  uncertainties,
  onRemapped,
}: {
  weekKey: string;
  isCurrentWeek: boolean;
  plannedMinutes: number;
  actualMinutes: number;
  notes: BoardNote[];
  companyId: string;
  projectId: string;
  canRemap: boolean;
  uncertainties: LaneUncertaintyOption[];
  onRemapped: () => void;
}) {
  const [open, setOpen] = useState(false);
  const dominant = dominantType(notes);
  const stateLabel = dominant ? TYPE_STYLE[dominant].label : "No progress";
  const actualColor = dominant ? TYPE_STYLE[dominant].ramp : TYPE_STYLE.NO_PROGRESS.ramp;
  const hasNotes = notes.length > 0;
  const label = `${weekKey}: ${hoursLabel(plannedMinutes)}h planned, ${hoursLabel(actualMinutes)}h logged, ${stateLabel}`;

  return (
    <div
      className={`group relative flex w-[26px] shrink-0 flex-col items-center gap-2 ${
        isCurrentWeek ? "-my-[6px] rounded-[10px] bg-accent-wash py-[6px]" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => hasNotes && setOpen((o) => !o)}
        aria-label={label}
        className="relative h-[104px] w-full cursor-default rounded-[4px] outline-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        style={{ cursor: hasNotes ? "pointer" : "default" }}
      >
        <span
          className="absolute bottom-0 left-1/2 w-[14px] -translate-x-1/2 rounded-[7px] bg-track"
          style={{ height: barHeight(plannedMinutes) }}
        />
        <span
          className="absolute bottom-0 left-1/2 w-[14px] -translate-x-1/2 rounded-[7px]"
          style={{ height: barHeight(actualMinutes), background: actualColor }}
        />
      </button>

      <span className={`text-[11px] ${isCurrentWeek ? "font-[590] text-accent" : "text-text-quaternary"}`}>{weekKey.slice(6)}</span>

      <div
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-[6px] bg-text px-[9px] py-[5px] text-[11px] text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </div>

      {open && hasNotes && (
        <div className="absolute left-1/2 top-[calc(100%+8px)] z-30 w-60 -translate-x-1/2">
          <div className="flex flex-col gap-2 rounded-[12px] border border-black/[.06] bg-white p-2 shadow-[0_4px_16px_rgba(0,0,0,.14)]">
            {notes.map((note) => (
              <NoteDetail
                key={note.id}
                note={note}
                companyId={companyId}
                projectId={projectId}
                canRemap={canRemap}
                uncertainties={uncertainties}
                onRemapped={() => {
                  setOpen(false);
                  onRemapped();
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Lane({
  lane,
  weekKeys,
  currentWeekKey,
  companyId,
  uncertainties,
  canRemap,
  onRemapped,
}: {
  lane: BoardData["lanes"][number];
  weekKeys: string[];
  currentWeekKey: string;
  companyId: string;
  uncertainties: LaneUncertaintyOption[];
  canRemap: boolean;
  onRemapped: () => void;
}) {
  const totalPlanned = Object.values(lane.plannedMinutesByWeek).reduce((a, b) => a + b, 0);
  const totalActual = Object.values(lane.actualMinutesByWeek).reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken px-6 pb-6 pt-[22px]">
      <div className="mb-6 flex items-baseline justify-between">
        <Link href={`/projects/${lane.projectId}`} className="hover:underline">
          <h4 className="m-0 text-[15.5px] font-[600] tracking-[-0.02em] text-text">{lane.projectName}</h4>
        </Link>
        <span className="text-[13px] text-text-tertiary">
          {hoursLabel(totalActual)}h logged · <span className="text-text">{hoursLabel(totalPlanned)}h</span> planned
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="flex w-max items-end gap-[6px]">
          {weekKeys.map((weekKey) => (
            <WeekColumn
              key={weekKey}
              weekKey={weekKey}
              isCurrentWeek={weekKey === currentWeekKey}
              plannedMinutes={lane.plannedMinutesByWeek[weekKey] ?? 0}
              actualMinutes={lane.actualMinutesByWeek[weekKey] ?? 0}
              notes={lane.notesByWeek[weekKey] ?? []}
              companyId={companyId}
              projectId={lane.projectId}
              canRemap={canRemap}
              uncertainties={uncertainties}
              onRemapped={onRemapped}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function BoardClient({
  companyId,
  board,
  uncertaintiesByProject,
  remappableByProject,
}: {
  companyId: string;
  board: BoardData;
  uncertaintiesByProject: Record<string, LaneUncertaintyOption[]>;
  remappableByProject: Record<string, boolean>;
}) {
  const currentWeekKey = useMemo(() => getIsoWeekKey(new Date()), []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-[22px] text-[12.5px] text-text-tertiary">
        <span className="flex items-center gap-[6px]">
          <span className="h-3 w-3 rounded-[6px] bg-track" /> Planned
        </span>
        <span className="flex items-center gap-[10px]">
          Progress
          <span className="flex items-center gap-[3px]">
            {(["NO_PROGRESS", "ATTEMPT", "BLOCKER", "FAILED_ATTEMPT", "RESOLUTION"] as UncertaintyNoteType[]).map((type) => (
              <span key={type} className="h-3 w-3 rounded-[6px]" style={{ background: TYPE_STYLE[type].ramp }} title={TYPE_STYLE[type].label} />
            ))}
          </span>
          none → solved
        </span>
      </div>

      <div className="flex flex-col gap-[14px]">
        {board.lanes.map((lane) => (
          <Lane
            key={lane.projectId}
            lane={lane}
            weekKeys={board.weekKeys}
            currentWeekKey={currentWeekKey}
            companyId={companyId}
            uncertainties={uncertaintiesByProject[lane.projectId] ?? []}
            canRemap={remappableByProject[lane.projectId] ?? false}
            onRemapped={() => window.location.reload()}
          />
        ))}
      </div>
    </div>
  );
}
