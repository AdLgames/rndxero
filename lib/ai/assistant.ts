import type { PrismaClient } from "@/lib/generated/prisma/client";
import { buildCompanyContext, buildProjectContext } from "@/lib/ai/context";
import { searchGuidance, type GuidanceSearchResult } from "@/lib/ai/guidance-search";
import { chatComplete, type AiProviderSettings, type ChatMessage } from "@/lib/ai/provider";

export type AssistantScope = { type: "project"; projectId: string } | { type: "company"; companyId: string };

export interface GuidanceSource {
  sourceTitle: string;
  sourceUrl: string;
  heading: string | null;
}

export interface AssistantAnswer {
  answer: string;
  sources: GuidanceSource[];
}

/**
 * Kept strict on purpose: this assistant explains what HMRC's published
 * guidance says, and points out gaps in a project's own logged evidence
 * against it, cited to source — it never tells a user their project
 * "qualifies," which is the one thing CLAUDE.md says this product must
 * never decide.
 */
const SYSTEM_PROMPT = `You are ClaimTrail's assistant for HMRC R&D tax relief guidance. You are given (1) excerpts from HMRC's published guidance, and (2) a snapshot of the company's or project's own logged data — computed facts, not your own reading of it. Answer strictly from these two sources; do not rely on outside knowledge of tax law. Cite which guidance excerpt(s) support each point by their source title. If the excerpts don't contain enough to answer, say so plainly rather than guessing.

You never state whether a specific project or claim qualifies for R&D tax relief — that judgement always belongs to the company and their advisor, not you. You explain what the guidance says and where the logged evidence has gaps against it; you do not decide anyone's eligibility.`;

export function buildAssistantMessages(
  question: string,
  chunks: GuidanceSearchResult[],
  contextText: string,
  scopeType: AssistantScope["type"]
): ChatMessage[] {
  const guidanceBlock =
    chunks.length === 0
      ? "No guidance excerpts matched this question in the loaded corpus. Say so explicitly, answer only in very general terms if at all, and recommend the user check gov.uk's R&D guidance directly."
      : chunks.map((c, i) => `[${i + 1}] ${c.sourceTitle}${c.heading ? ` — ${c.heading}` : ""}\n${c.content}`).join("\n\n");

  const dataLabel = scopeType === "project" ? "Data logged for this project" : "Company-wide data";

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Guidance excerpts:\n\n${guidanceBlock}\n\n${dataLabel}:\n\n${contextText}\n\nQuestion: ${question}`,
    },
  ];
}

export async function askAssistant(
  prisma: PrismaClient,
  settings: AiProviderSettings,
  scope: AssistantScope,
  question: string
): Promise<AssistantAnswer> {
  const [chunks, contextText] = await Promise.all([
    searchGuidance(prisma, question),
    scope.type === "project" ? buildProjectContext(prisma, scope.projectId) : buildCompanyContext(prisma, scope.companyId),
  ]);

  const messages = buildAssistantMessages(question, chunks, contextText, scope.type);
  const answer = await chatComplete(settings, messages, { maxTokens: 700 });

  return {
    answer,
    sources: chunks.map((c) => ({ sourceTitle: c.sourceTitle, sourceUrl: c.sourceUrl, heading: c.heading })),
  };
}
