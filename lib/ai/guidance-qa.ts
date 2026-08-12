import type { PrismaClient } from "@/lib/generated/prisma/client";
import { searchGuidance, type GuidanceSearchResult } from "@/lib/ai/guidance-search";
import { chatComplete, type AiProviderSettings, type ChatMessage } from "@/lib/ai/provider";

export interface GuidanceSource {
  sourceTitle: string;
  sourceUrl: string;
  heading: string | null;
}

export interface GuidanceAnswer {
  answer: string;
  sources: GuidanceSource[];
}

/**
 * Kept strict on purpose: this assistant explains what HMRC's published
 * guidance says, cited to source — it never tells a user their project
 * "qualifies," which is the one thing CLAUDE.md says this product must
 * never decide.
 */
const SYSTEM_PROMPT = `You are ClaimTrail's assistant for HMRC R&D tax relief guidance. Answer strictly from the guidance excerpts provided below — do not rely on outside knowledge of tax law. Cite which excerpt(s) support each point by their source title. If the excerpts don't contain enough to answer, say so plainly rather than guessing.

You never state whether a specific project or claim qualifies for R&D tax relief — that judgement always belongs to the company and their advisor, not you. You explain what the guidance says; you do not apply it to anyone's specific facts.`;

export function buildGuidanceMessages(question: string, chunks: GuidanceSearchResult[]): ChatMessage[] {
  const context =
    chunks.length === 0
      ? "No guidance excerpts matched this question in the loaded corpus. Say so explicitly, answer only in very general terms if at all, and recommend the user check gov.uk's R&D guidance directly."
      : chunks.map((c, i) => `[${i + 1}] ${c.sourceTitle}${c.heading ? ` — ${c.heading}` : ""}\n${c.content}`).join("\n\n");

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Guidance excerpts:\n\n${context}\n\nQuestion: ${question}` },
  ];
}

export async function answerGuidanceQuestion(prisma: PrismaClient, settings: AiProviderSettings, question: string): Promise<GuidanceAnswer> {
  const chunks = await searchGuidance(prisma, question);
  const messages = buildGuidanceMessages(question, chunks);
  const answer = await chatComplete(settings, messages, { maxTokens: 700 });
  return {
    answer,
    sources: chunks.map((c) => ({ sourceTitle: c.sourceTitle, sourceUrl: c.sourceUrl, heading: c.heading })),
  };
}
