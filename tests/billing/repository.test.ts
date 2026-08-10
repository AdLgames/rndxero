import { describe, expect, it } from "vitest";
import { isEntitled, mapStripeStatus } from "@/lib/billing/repository";

describe("mapStripeStatus", () => {
  it("maps trialing and active to entitled statuses", () => {
    expect(mapStripeStatus("trialing")).toBe("TRIALING");
    expect(mapStripeStatus("active")).toBe("ACTIVE");
  });

  it("maps payment-trouble statuses to PAST_DUE", () => {
    expect(mapStripeStatus("past_due")).toBe("PAST_DUE");
    expect(mapStripeStatus("unpaid")).toBe("PAST_DUE");
    expect(mapStripeStatus("incomplete")).toBe("PAST_DUE");
  });

  it("maps terminal statuses to CANCELED", () => {
    expect(mapStripeStatus("canceled")).toBe("CANCELED");
    expect(mapStripeStatus("incomplete_expired")).toBe("CANCELED");
    expect(mapStripeStatus("paused")).toBe("CANCELED");
  });
});

describe("isEntitled", () => {
  it("is true for TRIALING and ACTIVE", () => {
    expect(isEntitled("TRIALING")).toBe(true);
    expect(isEntitled("ACTIVE")).toBe(true);
  });

  it("is false for PAST_DUE and CANCELED", () => {
    expect(isEntitled("PAST_DUE")).toBe(false);
    expect(isEntitled("CANCELED")).toBe(false);
  });
});
