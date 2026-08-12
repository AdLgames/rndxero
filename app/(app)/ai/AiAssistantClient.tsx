"use client";

import { useState } from "react";
import { badgeAccent, badgeNeutral, buttonGhost } from "@/app/components/ui";
import type { AiProviderConfigSummary } from "@/lib/ai/repository";
import { AiChatPanel } from "./AiChatPanel";
import { AiSettingsForm } from "./AiSettingsForm";

export function AiAssistantClient({
  companyId,
  canConfigure,
  initialConfig,
}: {
  companyId: string;
  canConfigure: boolean;
  initialConfig: AiProviderConfigSummary | null;
}) {
  const [settingsOpen, setSettingsOpen] = useState(!initialConfig);

  return (
    <div className="flex flex-col gap-6">
      {canConfigure && (
        <div className="flex items-center justify-between">
          <span className={initialConfig ? badgeAccent : badgeNeutral}>
            {initialConfig ? `Connected — ${initialConfig.label} (${initialConfig.model})` : "Not configured"}
          </span>
          <button type="button" onClick={() => setSettingsOpen((v) => !v)} className={buttonGhost}>
            {settingsOpen ? "Hide settings" : "Manage settings"}
          </button>
        </div>
      )}

      {canConfigure && settingsOpen && <AiSettingsForm companyId={companyId} initialConfig={initialConfig} />}

      {initialConfig ? (
        <AiChatPanel companyId={companyId} />
      ) : (
        <p className="text-[14px] text-text-secondary">
          {canConfigure
            ? "Configure a provider above to start asking questions."
            : "Ask a company Owner to connect an AI provider before this is usable."}
        </p>
      )}
    </div>
  );
}
