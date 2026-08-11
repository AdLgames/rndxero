import { describe, expect, it } from "vitest";
import { parseGithubEvent } from "@/lib/github/ingest";

describe("parseGithubEvent", () => {
  it("produces one suggestion per commit on a push event, using the first message line", () => {
    const suggestions = parseGithubEvent("push", {
      commits: [
        { id: "sha1", message: "Fix cache eviction\n\nLonger body here." },
        { id: "sha2", message: "Add streaming prototype" },
      ],
    });
    expect(suggestions).toEqual([
      { externalRef: "sha1", summary: "Fix cache eviction" },
      { externalRef: "sha2", summary: "Add streaming prototype" },
    ]);
  });

  it("produces nothing for a push with no commits", () => {
    expect(parseGithubEvent("push", {})).toEqual([]);
  });

  it("produces one suggestion for a newly-opened pull_request", () => {
    const suggestions = parseGithubEvent("pull_request", {
      action: "opened",
      pull_request: { number: 42, title: "Two-tier cache" },
    });
    expect(suggestions).toEqual([{ externalRef: "pr-42", summary: "PR #42: Two-tier cache" }]);
  });

  it("ignores non-opened pull_request actions (e.g. closed, synchronize)", () => {
    expect(parseGithubEvent("pull_request", { action: "closed", pull_request: { number: 42, title: "x" } })).toEqual([]);
    expect(parseGithubEvent("pull_request", { action: "synchronize", pull_request: { number: 42, title: "x" } })).toEqual([]);
  });

  it("ignores event types it doesn't understand", () => {
    expect(parseGithubEvent("issues", { action: "opened" })).toEqual([]);
    expect(parseGithubEvent("star", {})).toEqual([]);
  });

  it("truncates an implausibly long commit message to 500 chars", () => {
    const suggestions = parseGithubEvent("push", { commits: [{ id: "sha1", message: "x".repeat(600) }] });
    expect(suggestions[0].summary).toHaveLength(500);
  });
});
