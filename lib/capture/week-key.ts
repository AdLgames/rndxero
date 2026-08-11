/**
 * ISO week keys, Europe/London (BOARD-PLAN.md Phase 0 decision #3): a
 * week is Monday-Sunday in the UK's local calendar, stored as a key like
 * "2026-W33" — never a date range. Storing a range invites the exact bug
 * this decision was made to avoid: a date range doesn't survive a BST/GMT
 * clock change unambiguously, a week key does.
 *
 * No timezone library dependency — Intl.DateTimeFormat with a timeZone
 * option is sufficient and already correct for BST/GMT transitions; the
 * offset-diffing technique in londonMidnightUtc is the standard
 * non-library way to convert a local calendar date to the right UTC
 * instant.
 */

const LONDON_TZ = "Europe/London";

function londonDateParts(date: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** UTC instant corresponding to 00:00 local time in Europe/London on the given calendar date. */
function londonMidnightUtc(year: number, month: number, day: number): Date {
  const guess = new Date(Date.UTC(year, month - 1, day));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: LONDON_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const hour = get("hour") % 24; // Intl can render midnight as "24"
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  const offsetMs = asIfUtc - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}

function isoWeekOfCalendarDate(year: number, month: number, day: number): { isoYear: number; week: number } {
  const thursday = new Date(Date.UTC(year, month - 1, day));
  const mondayIndexedDay = (thursday.getUTCDay() + 6) % 7; // Monday = 0 .. Sunday = 6
  thursday.setUTCDate(thursday.getUTCDate() - mondayIndexedDay + 3); // move to this week's Thursday
  const isoYear = thursday.getUTCFullYear();

  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4MondayIndexedDay = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4MondayIndexedDay);

  const week = Math.round((thursday.getTime() - week1Monday.getTime()) / (7 * 86_400_000)) + 1;
  return { isoYear, week };
}

/** The ISO week key ("2026-W33") for `date`, evaluated in Europe/London local time. */
export function getIsoWeekKey(date: Date): string {
  const { year, month, day } = londonDateParts(date);
  const { isoYear, week } = isoWeekOfCalendarDate(year, month, day);
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

export interface WeekBoundaries {
  /** Monday 00:00 Europe/London, as a UTC instant. */
  start: Date;
  /** The following Monday 00:00 Europe/London, as a UTC instant (exclusive end). */
  end: Date;
}

const WEEK_KEY_PATTERN = /^(\d{4})-W(\d{2})$/;

/** Resolves a week key back to its Monday-Sunday boundaries as real UTC instants. */
export function getWeekBoundaries(weekKey: string): WeekBoundaries {
  const match = WEEK_KEY_PATTERN.exec(weekKey);
  if (!match) {
    throw new Error(`Invalid week key: ${weekKey}`);
  }
  const isoYear = Number(match[1]);
  const week = Number(match[2]);

  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4MondayIndexedDay = (jan4.getUTCDay() + 6) % 7;
  const week1MondayCalendar = new Date(jan4);
  week1MondayCalendar.setUTCDate(jan4.getUTCDate() - jan4MondayIndexedDay + (week - 1) * 7);

  const start = londonMidnightUtc(
    week1MondayCalendar.getUTCFullYear(),
    week1MondayCalendar.getUTCMonth() + 1,
    week1MondayCalendar.getUTCDate()
  );
  const endCalendar = new Date(week1MondayCalendar);
  endCalendar.setUTCDate(endCalendar.getUTCDate() + 7);
  const end = londonMidnightUtc(endCalendar.getUTCFullYear(), endCalendar.getUTCMonth() + 1, endCalendar.getUTCDate());

  return { start, end };
}

/**
 * Derived automatically, never asked (BOARD-PLAN.md Phase 3.6): true when
 * a submission for `weekKey` is being recorded after that week's Monday
 * close.
 */
export function isRetrospective(submittedAt: Date, weekKey: string): boolean {
  const { end } = getWeekBoundaries(weekKey);
  return submittedAt.getTime() >= end.getTime();
}

/**
 * `weekKey`, `deltaWeeks` calendar weeks later (negative to go back) —
 * the board's week columns (Phase 6.1) are built by walking this from a
 * start key. Deliberately done in whole calendar weeks against the same
 * Jan-4 ISO anchor `getWeekBoundaries` uses, converting to an instant
 * only at the very end (at London noon, never midnight, so the read-back
 * can't land on the wrong calendar date) — a week is always 7 calendar
 * days regardless of any BST/GMT change crossed along the way, so this
 * never needs to reason about DST at all, unlike adding
 * `deltaWeeks * 7 * 86_400_000` milliseconds to an instant would.
 */
export function shiftWeekKey(weekKey: string, deltaWeeks: number): string {
  const match = WEEK_KEY_PATTERN.exec(weekKey);
  if (!match) {
    throw new Error(`Invalid week key: ${weekKey}`);
  }
  const isoYear = Number(match[1]);
  const week = Number(match[2]);

  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4MondayIndexedDay = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4MondayIndexedDay + (week - 1 + deltaWeeks) * 7);

  const noon = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 12));
  return getIsoWeekKey(noon);
}
