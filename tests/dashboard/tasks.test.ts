import { describe, expect, it } from "vitest";
import { buildNextActions } from "@/lib/dashboard/tasks";

const BASE = {
  weekKey: "2026-W33",
  daysUntilAutoLock: 6,
  unloggedProjects: [],
  amberNoteCount: 0,
  unlockedSubmissionCount: 0,
  pendingSuggestionCount: 0,
};

describe("buildNextActions", () => {
  it("is empty when everything is caught up", () => {
    expect(buildNextActions(BASE)).toEqual([]);
  });

  it("surfaces unlogged projects, naming them", () => {
    const actions = buildNextActions({
      ...BASE,
      unloggedProjects: [
        { projectId: "p1", projectName: "Widget Engine" },
        { projectId: "p2", projectName: "Payments Sync" },
      ],
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe("log_week");
    expect(actions[0].count).toBe(2);
    expect(actions[0].description).toContain("Widget Engine");
    expect(actions[0].description).toContain("Payments Sync");
    expect(actions[0].href).toBe("/capture");
  });

  it("flags urgency once the auto-lock deadline is close", () => {
    const actions = buildNextActions({
      ...BASE,
      daysUntilAutoLock: 2,
      unloggedProjects: [{ projectId: "p1", projectName: "Widget Engine" }],
    });
    expect(actions[0].description).toContain("closing soon");
  });

  it("does not flag urgency when the deadline is comfortably away", () => {
    const actions = buildNextActions({
      ...BASE,
      daysUntilAutoLock: 6,
      unloggedProjects: [{ projectId: "p1", projectName: "Widget Engine" }],
    });
    expect(actions[0].description).not.toContain("closing soon");
  });

  it("surfaces amber (missing evidence) notes", () => {
    const actions = buildNextActions({ ...BASE, amberNoteCount: 3 });
    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe("add_evidence");
    expect(actions[0].count).toBe(3);
    expect(actions[0].href).toBe("/capture");
  });

  it("surfaces unlocked settled weeks for finance", () => {
    const actions = buildNextActions({ ...BASE, unlockedSubmissionCount: 1 });
    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe("lock_weeks");
    expect(actions[0].description).toContain("1 submitted week");
    expect(actions[0].href).toBe("/finance");
  });

  it("surfaces pending GitHub suggestions", () => {
    const actions = buildNextActions({ ...BASE, pendingSuggestionCount: 5 });
    expect(actions).toHaveLength(1);
    expect(actions[0].kind).toBe("review_suggestions");
    expect(actions[0].count).toBe(5);
    expect(actions[0].href).toBe("/github");
  });

  it("orders by urgency: log week, then evidence, then lock, then review", () => {
    const actions = buildNextActions({
      weekKey: "2026-W33",
      daysUntilAutoLock: 6,
      unloggedProjects: [{ projectId: "p1", projectName: "Widget Engine" }],
      amberNoteCount: 2,
      unlockedSubmissionCount: 1,
      pendingSuggestionCount: 4,
    });
    expect(actions.map((a) => a.kind)).toEqual(["log_week", "add_evidence", "lock_weeks", "review_suggestions"]);
  });
});
