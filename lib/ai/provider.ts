/**
 * Bring-your-own-AI client. Speaks the OpenAI-compatible chat completions
 * API (POST {baseUrl}/chat/completions) — the interface OpenAI, Azure
 * OpenAI, and most self-hosted servers (Ollama, vLLM, LM Studio,
 * llama.cpp server) all implement, so this app never runs or pays for its
 * own inference. Every company brings its own baseUrl/apiKey/model.
 */

export interface AiProviderSettings {
  baseUrl: string;
  apiKey?: string | null;
  model: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}

interface ChatCompleteOptions {
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  /** Injected for tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

function endpointUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

/** Sends a chat completion request and returns the assistant's reply text. Throws AiProviderError on any failure — unreachable endpoint, non-2xx, or an unparseable response. */
export async function chatComplete(settings: AiProviderSettings, messages: ChatMessage[], options: ChatCompleteOptions = {}): Promise<string> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (settings.apiKey) headers.Authorization = `Bearer ${settings.apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

  let response: Response;
  try {
    response = await fetchImpl(endpointUrl(settings.baseUrl), {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 800,
      }),
    });
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timed out" : error instanceof Error ? error.message : String(error);
    throw new AiProviderError(`Could not reach the AI provider (${reason}). Check the base URL and that the server is running.`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new AiProviderError(`AI provider returned ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`);
  }

  const data = (await response.json().catch(() => null)) as { choices?: Array<{ message?: { content?: string } }> } | null;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new AiProviderError("AI provider returned an empty or unrecognised response");
  }
  return content;
}

/** For the settings page's "Test connection" button — a minimal round trip that never throws. */
export async function testConnection(
  settings: AiProviderSettings,
  options: { fetchImpl?: typeof fetch } = {}
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await chatComplete(settings, [{ role: "user", content: 'Reply with exactly one word: "OK".' }], {
      maxTokens: 5,
      timeoutMs: 15_000,
      fetchImpl: options.fetchImpl,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
