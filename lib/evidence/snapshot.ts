import { createHash } from "node:crypto";

/**
 * Deterministically stringifies a JSON-compatible value: object keys are
 * sorted recursively so that two logically-identical payloads with
 * differently-ordered keys hash to the same value.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    if (value instanceof Date) {
      return value.toISOString();
    }
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

/** SHA-256 hash of the canonical form of `data`, as lowercase hex. */
export function computeSnapshotHash(data: unknown): string {
  return createHash("sha256").update(canonicalize(data)).digest("hex");
}
