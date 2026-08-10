/**
 * Append-only evidence log.
 *
 * Core rule (PLAN.md Phase 2): once written, an evidence entry is never
 * mutated or deleted. Corrections are new entries that supersede a prior
 * entry; both are retained. This module only exposes ways to read and
 * append — there is deliberately no update or remove.
 */

export type EvidenceEntryType =
  | "uncertainty_raised"
  | "approach_attempted"
  | "result_observed"
  | "resolution"
  | "decision";

export interface EvidenceEntry {
  readonly id: string;
  readonly projectId: string;
  readonly type: EvidenceEntryType;
  readonly body: string;
  readonly authorId: string;
  readonly createdAt: Date;
  /** id of the entry this one corrects, if any. The superseded entry is kept. */
  readonly supersedes: string | null;
}

export type NewEvidenceEntry = Omit<EvidenceEntry, "createdAt"> & {
  createdAt?: Date;
};

export type EvidenceLog = ReadonlyArray<EvidenceEntry>;

function freezeEntry(entry: EvidenceEntry): EvidenceEntry {
  return Object.freeze({ ...entry });
}

/** An empty, frozen evidence log. */
export function createLog(): EvidenceLog {
  return Object.freeze([]);
}

/**
 * Appends a new entry and returns a new log. The input log is never
 * mutated. Throws if `id` already exists in the log (append-only means
 * an id is written exactly once).
 */
export function append(log: EvidenceLog, entry: NewEvidenceEntry): EvidenceLog {
  if (log.some((existing) => existing.id === entry.id)) {
    throw new Error(`Evidence entry ${entry.id} already exists and cannot be overwritten`);
  }
  const withDefaults: EvidenceEntry = {
    ...entry,
    createdAt: entry.createdAt ?? new Date(),
  };
  return Object.freeze([...log, freezeEntry(withDefaults)]);
}

/**
 * Records a correction to `supersededId`. This is the only sanctioned way
 * to "change" an entry: the prior entry is left in the log untouched, and
 * a new entry pointing at it via `supersedes` is appended.
 */
export function supersede(
  log: EvidenceLog,
  supersededId: string,
  entry: Omit<NewEvidenceEntry, "supersedes">
): EvidenceLog {
  const target = log.find((existing) => existing.id === supersededId);
  if (!target) {
    throw new Error(`Cannot supersede unknown evidence entry ${supersededId}`);
  }
  return append(log, { ...entry, supersedes: supersededId });
}

/** Resolves an entry's current, non-superseded successor (or itself if none). */
export function currentVersion(log: EvidenceLog, entryId: string): EvidenceEntry | undefined {
  const successor = log.find((entry) => entry.supersedes === entryId);
  if (!successor) {
    return log.find((entry) => entry.id === entryId);
  }
  return currentVersion(log, successor.id);
}
