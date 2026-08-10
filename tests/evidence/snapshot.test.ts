import { describe, expect, it } from "vitest";
import { canonicalize, computeSnapshotHash } from "@/lib/evidence/snapshot";

describe("canonicalize", () => {
  it("produces the same string regardless of key order", () => {
    const a = canonicalize({ b: 1, a: 2 });
    const b = canonicalize({ a: 2, b: 1 });

    expect(a).toBe(b);
  });

  it("canonicalizes nested objects and arrays", () => {
    const a = canonicalize({ list: [{ y: 1, x: 2 }], meta: { b: true, a: false } });
    const b = canonicalize({ meta: { a: false, b: true }, list: [{ x: 2, y: 1 }] });

    expect(a).toBe(b);
  });

  it("normalizes Date instances to ISO strings", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    expect(canonicalize({ createdAt: date })).toBe('{"createdAt":"2026-01-01T00:00:00.000Z"}');
  });
});

describe("computeSnapshotHash", () => {
  it("is deterministic for identical data regenerated later", () => {
    const data = {
      projectId: "project-1",
      entries: [
        { id: "e1", body: "uncertainty" },
        { id: "e2", body: "resolution" },
      ],
    };

    const first = computeSnapshotHash(data);
    const regenerated = computeSnapshotHash(JSON.parse(JSON.stringify(data)));

    expect(regenerated).toBe(first);
  });

  it("is insensitive to key ordering", () => {
    const hashA = computeSnapshotHash({ a: 1, b: 2 });
    const hashB = computeSnapshotHash({ b: 2, a: 1 });

    expect(hashA).toBe(hashB);
  });

  it("changes when the underlying data changes", () => {
    const hashA = computeSnapshotHash({ total: 100 });
    const hashB = computeSnapshotHash({ total: 101 });

    expect(hashA).not.toBe(hashB);
  });

  it("produces a 64-character lowercase hex sha256 digest", () => {
    const hash = computeSnapshotHash({ x: 1 });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
