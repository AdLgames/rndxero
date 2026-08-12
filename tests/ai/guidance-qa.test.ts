import { describe, expect, it, vi } from "vitest";
import { buildGuidanceMessages } from "@/lib/ai/guidance-qa";
import type { GuidanceSearchResult } from "@/lib/ai/guidance-search";

const CHUNK: GuidanceSearchResult = {
  id: "chunk-1",
  sourceTitle: "CIRD81900",
  sourceUrl: "https://www.gov.uk/hmrc-internal-manuals/.../cird81900",
  heading: "Definition of R&D",
  content: "R&D takes place when a project seeks an advance in science or technology.",
};

describe("buildGuidanceMessages", () => {
  it("includes the guidance content and the question", () => {
    const messages = buildGuidanceMessages("What counts as an advance?", [CHUNK]);
    const userMessage = messages.find((m) => m.role === "user");
    expect(userMessage?.content).toContain(CHUNK.content);
    expect(userMessage?.content).toContain("What counts as an advance?");
    expect(userMessage?.content).toContain(CHUNK.sourceTitle);
  });

  it("never instructs the model to decide qualification, and forbids it in the system prompt", () => {
    const messages = buildGuidanceMessages("Does my project qualify?", [CHUNK]);
    const systemMessage = messages.find((m) => m.role === "system");
    expect(systemMessage?.content).toMatch(/never state whether a specific project or claim qualifies/i);
  });

  it("tells the model explicitly when no guidance matched, rather than silently answering from nothing", () => {
    const messages = buildGuidanceMessages("Some obscure question", []);
    const userMessage = messages.find((m) => m.role === "user");
    expect(userMessage?.content).toMatch(/No guidance excerpts matched/);
  });

  it("numbers multiple excerpts so the model can cite them", () => {
    const second: GuidanceSearchResult = { ...CHUNK, id: "chunk-2", sourceTitle: "CIRD82000", heading: "Software" };
    const messages = buildGuidanceMessages("q", [CHUNK, second]);
    const userMessage = messages.find((m) => m.role === "user");
    expect(userMessage?.content).toContain("[1] CIRD81900");
    expect(userMessage?.content).toContain("[2] CIRD82000");
  });
});

describe("answerGuidanceQuestion", () => {
  it("retrieves chunks, sends them to the model, and returns the answer with citations", async () => {
    vi.resetModules();
    const searchGuidance = vi.fn().mockResolvedValue([CHUNK]);
    const chatComplete = vi.fn().mockResolvedValue("The answer, citing [1].");
    vi.doMock("@/lib/ai/guidance-search", () => ({ searchGuidance }));
    vi.doMock("@/lib/ai/provider", () => ({ chatComplete }));

    const { answerGuidanceQuestion } = await import("@/lib/ai/guidance-qa");
    const settings = { baseUrl: "http://localhost/v1", apiKey: "k", model: "m" };
    const result = await answerGuidanceQuestion({} as never, settings, "What counts as R&D?");

    expect(searchGuidance).toHaveBeenCalledWith({}, "What counts as R&D?");
    expect(chatComplete).toHaveBeenCalledTimes(1);
    expect(result.answer).toBe("The answer, citing [1].");
    expect(result.sources).toEqual([{ sourceTitle: CHUNK.sourceTitle, sourceUrl: CHUNK.sourceUrl, heading: CHUNK.heading }]);

    vi.doUnmock("@/lib/ai/guidance-search");
    vi.doUnmock("@/lib/ai/provider");
  });
});
