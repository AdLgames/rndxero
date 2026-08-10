import { describe, expect, it } from "vitest";
import {
  append,
  createLog,
  currentVersion,
  supersede,
  type EvidenceLog,
} from "@/lib/evidence/append-only";

function makeEntry(overrides: Partial<Parameters<typeof append>[1]> = {}) {
  return {
    id: "entry-1",
    projectId: "project-1",
    type: "uncertainty_raised" as const,
    body: "Not sure the new caching layer will hold up under concurrent writes.",
    authorId: "author-1",
    supersedes: null,
    ...overrides,
  };
}

describe("append", () => {
  it("adds an entry without mutating the original log", () => {
    const original = createLog();
    const next = append(original, makeEntry());

    expect(original).toHaveLength(0);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("entry-1");
  });

  it("rejects appending an entry with a duplicate id", () => {
    const log = append(createLog(), makeEntry());

    expect(() => append(log, makeEntry({ body: "different body" }))).toThrow(
      /already exists/
    );
  });

  it("returns a frozen log and frozen entries", () => {
    const log = append(createLog(), makeEntry());

    expect(Object.isFrozen(log)).toBe(true);
    expect(Object.isFrozen(log[0])).toBe(true);
  });
});

describe("mutation resistance", () => {
  it("fails a deliberate attempt to mutate an existing entry's body", () => {
    const log = append(createLog(), makeEntry());

    expect(() => {
      // @ts-expect-error entries are readonly by type; this asserts the runtime guard too
      log[0].body = "rewritten after the fact";
    }).toThrow(TypeError);

    expect(log[0].body).toBe(
      "Not sure the new caching layer will hold up under concurrent writes."
    );
  });

  it("fails a deliberate attempt to push directly onto the log array", () => {
    const log: EvidenceLog = append(createLog(), makeEntry());

    expect(() => {
      // @ts-expect-error the log type has no push; this asserts the runtime guard too
      log.push(makeEntry({ id: "entry-2" }));
    }).toThrow(TypeError);

    expect(log).toHaveLength(1);
  });
});

describe("supersede", () => {
  it("keeps the original entry and appends a correction pointing at it", () => {
    const log = append(createLog(), makeEntry());
    const corrected = supersede(log, "entry-1", {
      id: "entry-2",
      projectId: "project-1",
      type: "resolution",
      body: "Confirmed: caching layer needed a write-through strategy, resolved in commit abc123.",
      authorId: "author-1",
    });

    expect(corrected).toHaveLength(2);
    expect(corrected.find((e) => e.id === "entry-1")).toBeDefined();
    expect(corrected.find((e) => e.id === "entry-2")?.supersedes).toBe("entry-1");
  });

  it("throws when superseding an id that does not exist", () => {
    const log = createLog();

    expect(() =>
      supersede(log, "missing-entry", {
        id: "entry-2",
        projectId: "project-1",
        type: "resolution",
        body: "n/a",
        authorId: "author-1",
      })
    ).toThrow(/unknown evidence entry/);
  });

  it("resolves currentVersion through a chain of corrections", () => {
    let log = append(createLog(), makeEntry());
    log = supersede(log, "entry-1", {
      id: "entry-2",
      projectId: "project-1",
      type: "resolution",
      body: "first correction",
      authorId: "author-1",
    });
    log = supersede(log, "entry-2", {
      id: "entry-3",
      projectId: "project-1",
      type: "resolution",
      body: "second correction",
      authorId: "author-1",
    });

    expect(currentVersion(log, "entry-1")?.id).toBe("entry-3");
    expect(log).toHaveLength(3);
  });
});
