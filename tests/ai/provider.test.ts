import { describe, expect, it, vi } from "vitest";
import { AiProviderError, chatComplete, testConnection } from "@/lib/ai/provider";

const SETTINGS = { baseUrl: "http://localhost:11434/v1", apiKey: "sk-test", model: "llama3.1" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("chatComplete", () => {
  it("posts to {baseUrl}/chat/completions with the model, messages, and bearer auth", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "hello" } }] }));
    await chatComplete(SETTINGS, [{ role: "user", content: "hi" }], { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/v1/chat/completions");
    expect(init.headers).toMatchObject({ Authorization: "Bearer sk-test" });
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("llama3.1");
    expect(body.messages).toEqual([{ role: "user", content: "hi" }]);
  });

  it("strips a trailing slash from baseUrl", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "hi" } }] }));
    await chatComplete({ ...SETTINGS, baseUrl: "http://localhost:11434/v1/" }, [{ role: "user", content: "hi" }], { fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toBe("http://localhost:11434/v1/chat/completions");
  });

  it("omits the Authorization header when no API key is set", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "hi" } }] }));
    await chatComplete({ ...SETTINGS, apiKey: null }, [{ role: "user", content: "hi" }], { fetchImpl });
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("returns the assistant's reply text", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "the answer" } }] }));
    const result = await chatComplete(SETTINGS, [{ role: "user", content: "hi" }], { fetchImpl });
    expect(result).toBe("the answer");
  });

  it("throws AiProviderError on a non-2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("bad request", { status: 400 }));
    await expect(chatComplete(SETTINGS, [{ role: "user", content: "hi" }], { fetchImpl })).rejects.toThrow(AiProviderError);
  });

  it("throws AiProviderError when the response has no parseable content", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ choices: [] }));
    await expect(chatComplete(SETTINGS, [{ role: "user", content: "hi" }], { fetchImpl })).rejects.toThrow(AiProviderError);
  });

  it("throws AiProviderError when the endpoint is unreachable", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(chatComplete(SETTINGS, [{ role: "user", content: "hi" }], { fetchImpl })).rejects.toThrow(AiProviderError);
  });
});

describe("testConnection", () => {
  it("returns ok: true on a successful round trip", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ choices: [{ message: { content: "OK" } }] }));
    await expect(testConnection(SETTINGS, { fetchImpl })).resolves.toEqual({ ok: true });
  });

  it("returns ok: false with an error message instead of throwing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 }));
    const result = await testConnection(SETTINGS, { fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("401");
  });
});
