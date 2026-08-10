import { describe, expect, it } from "vitest";
import {
  canTransition,
  InvalidApprovalTransitionError,
  transition,
} from "@/lib/approvals/state-machine";

describe("transition", () => {
  it("moves pending -> approved on approve", () => {
    expect(transition("pending", "approve")).toBe("approved");
  });

  it("moves pending -> queried on query", () => {
    expect(transition("pending", "query")).toBe("queried");
  });

  it("moves queried -> pending on resubmit", () => {
    expect(transition("queried", "resubmit")).toBe("pending");
  });

  it("rejects approving a queried item directly", () => {
    expect(() => transition("queried", "approve")).toThrow(InvalidApprovalTransitionError);
  });

  it("rejects resubmitting a pending item", () => {
    expect(() => transition("pending", "resubmit")).toThrow(InvalidApprovalTransitionError);
  });

  it("treats approved as terminal", () => {
    expect(() => transition("approved", "approve")).toThrow(InvalidApprovalTransitionError);
    expect(() => transition("approved", "query")).toThrow(InvalidApprovalTransitionError);
    expect(() => transition("approved", "resubmit")).toThrow(InvalidApprovalTransitionError);
  });
});

describe("canTransition", () => {
  it("agrees with transition on valid moves", () => {
    expect(canTransition("pending", "approve")).toBe(true);
    expect(canTransition("pending", "query")).toBe(true);
    expect(canTransition("queried", "resubmit")).toBe(true);
  });

  it("agrees with transition on invalid moves", () => {
    expect(canTransition("approved", "approve")).toBe(false);
    expect(canTransition("queried", "approve")).toBe(false);
  });
});
