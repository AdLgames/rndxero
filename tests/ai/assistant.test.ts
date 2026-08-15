import { describe, expect, it, vi } from "vitest";
import { buildAssistantMessages } from "@/lib/ai/assistant";
import type { GuidanceSearchResult } from "@/lib/ai/guidance-search";

const CHUNK: GuidanceSearchResult = {
  id: "chunk-1",
  sourceTitle: "CIRD81900",
  sourceUrl: "https://www.gov.uk/hmrc-internal-manuals/.../cird81900",
  heading: "Definition of R&D",
  content: "R&D takes place when a project seeks an advance in science or technology.",
};

describe("buildAssistantMessages", () => {
  it("includes the guidance content, the scoped data, and the question", () => {
    const messages = buildAssistantMessages("What counts as an advance?", [CHUNK], "Project: Widget Sync\nStatus: ACTIVE", "project");
    const userMessage = messages.find((m) => m.role === "user");
    expect(userMessage?.content).toContain(CHUNK.content);
    expect(userMessage?.content).toContain("Project: Widget Sync");
    expect(userMessage?.content).toContain("What counts as an advance?");
    expect(userMessage?.content).toContain(CHUNK.sourceTitle);
  });

  it("labels the data block by scope type", () => {
    const projectMessages = buildAssistantMessages("q", [], "ctx", "project");
    expect(projectMessages.find((m) => m.role === "user")?.content).toContain("Data logged for this project");

    const companyMessages = buildAssistantMessages("q", [], "ctx", "company");
    expect(companyMessages.find((m) => m.role === "user")?.content).toContain("Company-wide data");
  });

  it("never instructs the model to decide qualification, and forbids it in the system prompt", () => {
    const messages = buildAssistantMessages("Does my project qualify?", [CHUNK], "ctx", "project");
    const systemMessage = messages.find((m) => m.role === "system");
    expect(systemMessage?.content).toMatch(/never state whether a specific project or claim qualifies/i);
  });

  it("tells the model explicitly when no guidance matched, rather than silently answering from nothing", () => {
    const messages = buildAssistantMessages("Some obscure question", [], "ctx", "company");
    const userMessage = messages.find((m) => m.role === "user");
    expect(userMessage?.content).toMatch(/No guidance excerpts matched/);
  });

  it("numbers multiple excerpts so the model can cite them", () => {
    const second: GuidanceSearchResult = { ...CHUNK, id: "chunk-2", sourceTitle: "CIRD82000", heading: "Software" };
    const messages = buildAssistantMessages("q", [CHUNK, second], "ctx", "company");
    const userMessage = messages.find((m) => m.role === "user");
    expect(userMessage?.content).toContain("[1] CIRD81900");
    expect(userMessage?.content).toContain("[2] CIRD82000");
  });
});

describe("askAssistant", () => {
  it("retrieves guidance and the right context for a project scope, then sends both to the model", async () => {
    vi.resetModules();
    const searchGuidance = vi.fn().mockResolvedValue([CHUNK]);
    const buildProjectContext = vi.fn().mockResolvedValue("Project: Widget Sync");
    const buildCompanyContext = vi.fn().mockResolvedValue("Company-wide data");
    const chatComplete = vi.fn().mockResolvedValue("The answer, citing [1].");
    vi.doMock("@/lib/ai/guidance-search", () => ({ searchGuidance }));
    vi.doMock("@/lib/ai/context", () => ({ buildProjectContext, buildCompanyContext }));
    vi.doMock("@/lib/ai/provider", () => ({ chatComplete }));

    const { askAssistant } = await import("@/lib/ai/assistant");
    const settings = { baseUrl: "http://localhost/v1", apiKey: "k", model: "m" };
    const result = await askAssistant({} as never, settings, { type: "project", projectId: "proj-1" }, "What's missing?");

    expect(buildProjectContext).toHaveBeenCalledWith({}, "proj-1");
    expect(buildCompanyContext).not.toHaveBeenCalled();
    expect(searchGuidance).toHaveBeenCalledWith({}, "What's missing?");
    expect(chatComplete).toHaveBeenCalledTimes(1);
    expect(result.answer).toBe("The answer, citing [1].");
    expect(result.sources).toEqual([{ sourceTitle: CHUNK.sourceTitle, sourceUrl: CHUNK.sourceUrl, heading: CHUNK.heading }]);

    vi.doUnmock("@/lib/ai/guidance-search");
    vi.doUnmock("@/lib/ai/context");
    vi.doUnmock("@/lib/ai/provider");
  });

  it("uses company context for a company scope", async () => {
    vi.resetModules();
    const searchGuidance = vi.fn().mockResolvedValue([]);
    const buildProjectContext = vi.fn();
    const buildCompanyContext = vi.fn().mockResolvedValue("Company-wide data");
    const chatComplete = vi.fn().mockResolvedValue("answer");
    vi.doMock("@/lib/ai/guidance-search", () => ({ searchGuidance }));
    vi.doMock("@/lib/ai/context", () => ({ buildProjectContext, buildCompanyContext }));
    vi.doMock("@/lib/ai/provider", () => ({ chatComplete }));

    const { askAssistant } = await import("@/lib/ai/assistant");
    const settings = { baseUrl: "http://localhost/v1", apiKey: "k", model: "m" };
    await askAssistant({} as never, settings, { type: "company", companyId: "co-1" }, "q");

    expect(buildCompanyContext).toHaveBeenCalledWith({}, "co-1");
    expect(buildProjectContext).not.toHaveBeenCalled();

    vi.doUnmock("@/lib/ai/guidance-search");
    vi.doUnmock("@/lib/ai/context");
    vi.doUnmock("@/lib/ai/provider");
  });
});
