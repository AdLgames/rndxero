"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { UncertaintyNoteType } from "@/lib/generated/prisma/client";
import { getIsoWeekKey, shiftWeekKey } from "@/lib/capture/week-key";
import type { BoardData, BoardNote } from "@/lib/board/repository";
import { badgeSage, chip, eyebrow } from "@/app/components/ui";

export interface LaneUncertaintyOption {
  id: string;
  title: string;
}

/**
 * Only steel + sage exist in this palette, so five progress states are
 * told apart by weight/texture, not five different hues: no progress is
 * a bare outline, tried-something a light steel fill, blocker a solid
 * steel fill, hit-a-wall a diagonal steel hatch (the strongest visual
 * treatment — the best evidence available, not a warning sign), solved
 * it sage, matching sage's reserved role as the "solved" highlight.
 */
const TYPE_STYLE: Record<UncertaintyNoteType, { swatch: string; label: string }> = {
  NO_PROGRESS: { swatch: "border border-steel/40", label: "No progress" },
  ATTEMPT: { swatch: "bg-steel/40", label: "Tried something" },
  BLOCKER: { swatch: "bg-steel", label: "Blocker" },
  FAILED_ATTEMPT: { swatch: "bg-steel bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(255,255,255,0.6)_2px,rgba(255,255,255,0.6)_3px)]", label: "Hit a wall" },
  RESOLUTION: { swatch: "bg-sage", label: "Solved it" },
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
    <div className="border border-steel bg-white p-3 text-sm shadow-lg">
      <p className={eyebrow}>
        {TYPE_STYLE[note.type].label} {note.locked ? "· sealed" : ""}
      </p>
      <p className="mt-1 text-foreground/60">{note.uncertaintyTitle}</p>
      <p className="mt-1 text-foreground">{note.bodyPreview}</p>

      {canRemap && !note.locked && (
        <div className="mt-2 flex items-center gap-2 border-t border-steel/20 pt-2">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="border border-steel/40 bg-white px-2 py-1 text-xs text-foreground"
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
            className="border border-steel bg-steel px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Moving…" : "Move here"}
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

function WeekCell({
  weekKey,
  isCurrentWeek,
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
  isCurrentWeek: boolean;
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
  const actualFill = dominantType(notes);

  const visibleNotes = notes.slice(0, 3);
  const overflowCount = notes.length - visibleNotes.length;
  const openNote = notes.find((n) => n.id === openNoteId) ?? null;

  return (
    <div
      className={`relative w-[92px] shrink-0 border p-1 ${
        anyLocked
          ? "border-sage bg-sage/5"
          : isCurrentWeek
            ? "border-sage/60 bg-sage/5"
            : isEmpty
              ? "border-dashed border-steel/25"
              : "border-steel/25"
      }`}
    >
      {!isEmpty && (
        <div className="relative h-10 w-full">
          <div
            className="absolute bottom-0 left-0 w-3 border border-dashed border-steel/50"
            style={{ height: scale(plannedMinutes) }}
            title={`Planned: ${hoursLabel(plannedMinutes)}`}
          />
          <div
            className={`absolute bottom-0 left-4 w-3 ${actualFill ? TYPE_STYLE[actualFill].swatch : "bg-steel/60"}`}
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
              className={`h-3 w-3 ${TYPE_STYLE[note.type].swatch} ${note.locked ? "ring-1 ring-sage-dark" : ""}`}
              title={TYPE_STYLE[note.type].label}
            />
          ))}
          {overflowCount > 0 && <span className="text-[10px] leading-3 text-foreground/50">+{overflowCount}</span>}
        </div>
      )}

      <p className={`mt-0.5 text-[10px] ${isCurrentWeek ? "font-bold text-sage-dark" : "text-foreground/40"}`}>{weekKey.slice(6)}</p>

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
  currentWeekKey,
  maxMinutes,
  companyId,
  uncertainties,
  canRemap,
  onRemapped,
}: {
  lane: BoardData["lanes"][number];
  weekKeys: string[];
  currentWeekKey: string;
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
    <div className="border border-steel/30 bg-white p-2">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setCollapsed((c) => !c)} className="flex items-center gap-2 text-left text-sm font-bold text-foreground">
          <span className="text-steel">{collapsed ? "▸" : "▾"}</span>
          {lane.projectName}
        </button>
        <span className="text-xs text-foreground/50">
          {hoursLabel(totalActual)} logged / {hoursLabel(totalPlanned)} planned
        </span>
      </div>

      {collapsed ? (
        <p className="mt-1 pl-5 text-xs text-foreground/50">
          {startDate.toLocaleDateString("en-GB")}
          {endDate ? ` – ${endDate.toLocaleDateString("en-GB")}` : " – ongoing"}
        </p>
      ) : (
        <div className="mt-2 flex gap-1 overflow-x-auto pb-2">
          {weekKeys.map((weekKey) => (
            <WeekCell
              key={weekKey}
              weekKey={weekKey}
              isCurrentWeek={weekKey === currentWeekKey}
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

  const currentWeekKey = useMemo(() => getIsoWeekKey(new Date()), []);
  const prevFrom = shiftWeekKey(fromWeekKey, -weekCount);
  const nextFrom = shiftWeekKey(fromWeekKey, weekCount);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-xs">
        <Link href={`/board?company=${companyId}&from=${prevFrom}`} className={chip}>
          ← Previous {weekCount}
        </Link>
        <span className="font-semibold text-foreground/60">
          {board.weekKeys[0]} – {board.weekKeys[board.weekKeys.length - 1]}
        </span>
        <Link href={`/board?company=${companyId}&from=${nextFrom}`} className={chip}>
          Next {weekCount} →
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 border border-steel/20 bg-white p-2 text-xs text-foreground/60">
        {(Object.entries(TYPE_STYLE) as Array<[UncertaintyNoteType, (typeof TYPE_STYLE)[UncertaintyNoteType]]>).map(([type, style]) => (
          <span key={type} className="flex items-center gap-1">
            <span className={`h-2.5 w-2.5 ${style.swatch}`} />
            {style.label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-1.5 border border-dashed border-steel/50" /> Planned
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-1.5 bg-steel/60" /> Actual
        </span>
        <span className={badgeSage}>Current week</span>
      </div>

      <div className="flex flex-col gap-3">
        {board.lanes.map((lane) => (
          <Lane
            key={lane.projectId}
            lane={lane}
            weekKeys={board.weekKeys}
            currentWeekKey={currentWeekKey}
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
