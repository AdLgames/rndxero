"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Spinner } from "@/app/components/icons";
import { buttonPrimary, buttonSecondary, fieldLabel, input } from "@/app/components/ui";
import type { AiProviderConfigSummary } from "@/lib/ai/repository";

type Status = "idle" | "testing" | "saving";

export function AiSettingsForm({ companyId, initialConfig }: { companyId: string; initialConfig: AiProviderConfigSummary | null }) {
  const router = useRouter();
  const [label, setLabel] = useState(initialConfig?.label ?? "");
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl ?? "");
  const [model, setModel] = useState(initialConfig?.model ?? "");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [saveError, setSaveError] = useState("");

  async function test() {
    setStatus("testing");
    setTestResult(null);
    try {
      const response = await fetch("/api/ai/config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, baseUrl, model, apiKey: apiKey.trim() || undefined }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string };
      setTestResult(body.ok ? { ok: true } : { ok: false, error: body.error ?? "Test failed" });
    } catch {
      setTestResult({ ok: false, error: "Could not reach the server" });
    } finally {
      setStatus("idle");
    }
  }

  async function save() {
    setStatus("saving");
    setSaveError("");
    try {
      const response = await fetch("/api/ai/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, label, baseUrl, model, apiKey: apiKey.trim() || undefined }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setSaveError(body.error ?? "Could not save");
        setStatus("idle");
        return;
      }
      setApiKey("");
      router.refresh();
    } finally {
      setStatus("idle");
    }
  }

  const canSubmit = label.trim() !== "" && baseUrl.trim() !== "" && model.trim() !== "";

  return (
    <div className="rounded-[16px] border border-black/[.06] bg-surface-sunken p-6">
      <p className="m-0 mb-4 text-[13px] leading-[1.5] text-text-secondary">
        Point this at any OpenAI-compatible endpoint — OpenAI, Azure OpenAI, or a self-hosted server (Ollama,
        vLLM, LM Studio). Your API key is encrypted at rest and never leaves this server except in the request
        to your provider.
      </p>

      <div className="flex flex-col gap-4">
        <div>
          <label className={fieldLabel}>Label</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Our OpenAI account" className={input} />
        </div>
        <div>
          <label className={fieldLabel}>Base URL</label>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" className={input} />
        </div>
        <div>
          <label className={fieldLabel}>Model</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" className={input} />
        </div>
        <div>
          <label className={fieldLabel}>API key {initialConfig?.hasApiKey && <span className="text-text-quaternary">(leave blank to keep the current one)</span>}</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={initialConfig?.hasApiKey ? "••••••••" : "optional — not all self-hosted servers need one"}
            className={input}
          />
        </div>
      </div>

      {testResult && (
        <p className={`m-0 mt-4 text-[13px] ${testResult.ok ? "text-accent" : "text-red-700"}`}>
          {testResult.ok ? "Connection works." : `Connection failed: ${testResult.error}`}
        </p>
      )}
      {saveError && <p className="m-0 mt-4 text-[13px] text-red-700">{saveError}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={!canSubmit || status !== "idle"} className={buttonPrimary}>
          {status === "saving" && <Spinner />}
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={test} disabled={!baseUrl.trim() || !model.trim() || status !== "idle"} className={buttonSecondary}>
          {status === "testing" && <Spinner />}
          {status === "testing" ? "Testing…" : "Test connection"}
        </button>
      </div>
    </div>
  );
}
