"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { UncertaintyNoteType } from "@/lib/generated/prisma/client";
import { shiftWeekKey } from "@/lib/capture/week-key";
import type { BoardData, BoardNote } from "@/lib/board/repository";

export interface LaneUncertaintyOption {
  id: string;
  title: string;
}

const TYPE_STYLE: Record<UncertaintyNoteType, { bg: string; label: string }> = {
  NO_PROGRESS: { bg: "bg-zinc-300 dark:bg-zinc-700", label: "No progress" },
  ATTEMPT: { bg: "bg-blue-400 dark:bg-blue-600", label: "Tried something" },
  BLOCKER: { bg: "bg-amber-400 dark:bg-amber-600", label: "Blocker" },
  // Failed attempts get the strongest visual treatment (Phase 6.4) — the best
  // evidence available, not a warning sign, so it reads as "notable", not "bad".
  FAILED_ATTEMPT: { bg: "bg-red-500 dark:bg-red-500", label: "Hit a wall" },
  RESOLUTION: { bg: "bg-green-500 dark:bg-green-600", label: "Solved it" },
};

function hoursLabel(minutes: number): string {
  const h = minutes / 60;
  return (Number.isInteger(h) ? h.toString() : h.toFixed(1)) + "h";
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
    <div className="rounded border border-black/[.12] bg-white p-3 text-sm shadow-lg dark:border-white/[.145] dark:bg-black">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {TYPE_STYLE[note.type].label} {note.locked ? "· sealed" : ""}
      </p>
      <p className="mt-1 text-zinc-500 dark:text-zinc-400">{note.uncertaintyTitle}</p>
      <p className="mt-1 text-black dark:text-zinc-50">{note.bodyPreview}</p>

      {canRemap && !note.locked && (
        <div className="mt-2 flex items-center gap-2 border-t border-black/[.06] pt-2 dark:border-white/[.06]">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="rounded border border-black/[.12] px-2 py-1 text-xs dark:border-white/[.145] dark:bg-black dark:text-zinc-50"
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
            className="rounded bg-foreground px-2 py-1 text-xs font-medium text-background disabled:opacity-50"
          >
            {busy ? "Moving…" : "Move here"}
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function WeekCell({
  weekKey,
  plannedMinutes,
  actualMinutes,
  notes,
  maxMinutes,
  companyId,
  projectId,
  canRemap,
  uncertainties,
  onRemapped,
}: {
  weekKey: string;
  plannedMinutes: number;
  actualMinutes: number;
  notes: BoardNote[];
  maxMinutes: number;
  companyId: string;
  projectId: string;
  canRemap: boolean;
  uncertainties: LaneUncertaintyOption[];
  onRemapped: () => void;
}) {
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const isEmpty = plannedMinutes === 0 && actualMinutes === 0 && notes.length === 0;
  const anyLocked = notes.some((n) => n.locked);
  const scale = (minutes: number) => (maxMinutes === 0 ? 0 : Math.max(2, Math.round((minutes / maxMinutes) * 36)));

  const visibleNotes = notes.slice(0, 3);
  const overflowCount = notes.length - visibleNotes.length;
  const openNote = notes.find((n) => n.id === openNoteId) ?? null;

  return (
    <div
      className={`relative w-[92px] shrink-0 rounded border p-1 ${
        isEmpty
          ? "border-dashed border-black/[.08] dark:border-white/[.08]"
          : anyLocked
            ? "border-amber-400/50 bg-amber-400/[.04] dark:border-amber-500/30"
            : "border-black/[.08] dark:border-white/[.08]"
      }`}
    >
      {!isEmpty && (
        <div className="relative h-10 w-full">
          <div
            className="absolute bottom-0 left-0 w-3 rounded-t border border-dashed border-zinc-400 dark:border-zinc-500"
            style={{ height: scale(plannedMinutes) }}
            title={`Planned: ${hoursLabel(plannedMinutes)}`}
          />
          <div
            className="absolute bottom-0 left-4 w-3 rounded-t bg-zinc-700 dark:bg-zinc-300"
            style={{ height: scale(actualMinutes) }}
            title={`Actual: ${hoursLabel(actualMinutes)}`}
          />
        </div>
      )}

      {notes.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-0.5">
          {visibleNotes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => setOpenNoteId(openNoteId === note.id ? null : note.id)}
              className={`h-3 w-3 rounded-sm ${TYPE_STYLE[note.type].bg} ${note.locked ? "ring-1 ring-amber-500" : ""}`}
              title={TYPE_STYLE[note.type].label}
            />
          ))}
          {overflowCount > 0 && (
            <span className="text-[10px] leading-3 text-zinc-500 dark:text-zinc-400">+{overflowCount}</span>
          )}
        </div>
      )}

      <p className="mt-0.5 text-[10px] text-zinc-400 dark:text-zinc-500">{weekKey.slice(6)}</p>

      {openNote && (
        <div className="absolute left-0 top-full z-10 mt-1 w-56">
          <NoteDetail
            note={openNote}
            companyId={companyId}
            projectId={projectId}
            canRemap={canRemap}
            uncertainties={uncertainties}
            onRemapped={() => {
              setOpenNoteId(null);
              onRemapped();
            }}
          />
        </div>
      )}
    </div>
  );
}

function Lane({
  lane,
  weekKeys,
  maxMinutes,
  companyId,
  uncertainties,
  canRemap,
  onRemapped,
}: {
  lane: BoardData["lanes"][number];
  weekKeys: string[];
  maxMinutes: number;
  companyId: string;
  uncertainties: LaneUncertaintyOption[];
  canRemap: boolean;
  onRemapped: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const totalPlanned = Object.values(lane.plannedMinutesByWeek).reduce((a, b) => a + b, 0);
  const totalActual = Object.values(lane.actualMinutesByWeek).reduce((a, b) => a + b, 0);
  const startDate = new Date(lane.startDate);
  const endDate = lane.endDate ? new Date(lane.endDate) : null;

  return (
    <div className="rounded border border-black/[.08] p-2 dark:border-white/[.08]">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-left text-sm font-medium text-black dark:text-zinc-50"
        >
          <span className="text-zinc-400">{collapsed ? "▸" : "▾"}</span>
          {lane.projectName}
        </button>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {hoursLabel(totalActual)} logged / {hoursLabel(totalPlanned)} planned
        </span>
      </div>

      {collapsed ? (
        <p className="mt-1 pl-5 text-xs text-zinc-500 dark:text-zinc-400">
          {startDate.toLocaleDateString("en-GB")}
          {endDate ? ` – ${endDate.toLocaleDateString("en-GB")}` : " – ongoing"}
        </p>
      ) : (
        <div className="mt-2 flex gap-1 overflow-x-auto pb-2">
          {weekKeys.map((weekKey) => (
            <WeekCell
              key={weekKey}
              weekKey={weekKey}
              plannedMinutes={lane.plannedMinutesByWeek[weekKey] ?? 0}
              actualMinutes={lane.actualMinutesByWeek[weekKey] ?? 0}
              notes={lane.notesByWeek[weekKey] ?? []}
              maxMinutes={maxMinutes}
              companyId={companyId}
              projectId={lane.projectId}
              canRemap={canRemap}
              uncertainties={uncertainties}
              onRemapped={onRemapped}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BoardClient({
  companyId,
  board,
  uncertaintiesByProject,
  remappableByProject,
  fromWeekKey,
  weekCount,
}: {
  companyId: string;
  board: BoardData;
  uncertaintiesByProject: Record<string, LaneUncertaintyOption[]>;
  remappableByProject: Record<string, boolean>;
  fromWeekKey: string;
  weekCount: number;
}) {
  const maxMinutes = useMemo(() => {
    let max = 0;
    for (const lane of board.lanes) {
      for (const v of Object.values(lane.plannedMinutesByWeek)) max = Math.max(max, v);
      for (const v of Object.values(lane.actualMinutesByWeek)) max = Math.max(max, v);
    }
    return max;
  }, [board]);

  const prevFrom = shiftWeekKey(fromWeekKey, -weekCount);
  const nextFrom = shiftWeekKey(fromWeekKey, weekCount);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm">
        <Link href={`/board?company=${companyId}&from=${prevFrom}`} className="text-zinc-600 underline dark:text-zinc-400">
          ← Previous {weekCount} weeks
        </Link>
        <span className="text-zinc-500 dark:text-zinc-400">
          {board.weekKeys[0]} – {board.weekKeys[board.weekKeys.length - 1]}
        </span>
        <Link href={`/board?company=${companyId}&from=${nextFrom}`} className="text-zinc-600 underline dark:text-zinc-400">
          Next {weekCount} weeks →
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        {(Object.entries(TYPE_STYLE) as Array<[UncertaintyNoteType, (typeof TYPE_STYLE)[UncertaintyNoteType]]>).map(
          ([type, style]) => (
            <span key={type} className="flex items-center gap-1">
              <span className={`h-2.5 w-2.5 rounded-sm ${style.bg}`} />
              {style.label}
            </span>
          )
        )}
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-1.5 rounded-t border border-dashed border-zinc-400 dark:border-zinc-500" /> Planned
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-1.5 rounded-t bg-zinc-700 dark:bg-zinc-300" /> Actual
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {board.lanes.map((lane) => (
          <Lane
            key={lane.projectId}
            lane={lane}
            weekKeys={board.weekKeys}
            maxMinutes={maxMinutes}
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
