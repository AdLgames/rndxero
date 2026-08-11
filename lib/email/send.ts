import { Resend } from "resend";
import type { EmailContent } from "@/lib/email/templates";

/**
 * Sends transactional email via Resend. Without RESEND_API_KEY set, this
 * falls back to logging the content instead of sending — that's what
 * keeps local dev working without a Resend account, and it's also why a
 * magic link "sent" on a Vercel deployment with no key configured was
 * silently going nowhere (production suppresses the [dev] log branch).
 * Configuring RESEND_API_KEY is what turns this from a no-op into a real
 * send in every environment, including production.
 */

let cachedClient: Resend | null = null;

function getResendClient(apiKey: string): Resend {
  if (cachedClient) return cachedClient;
  cachedClient = new Resend(apiKey);
  return cachedClient;
}

export interface SendEmailParams extends EmailContent {
  to: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[email not configured] would send "${params.subject}" to ${params.to}:\n${params.text}`);
    return { sent: false };
  }

  const from = process.env.EMAIL_FROM ?? "ClaimTrail <onboarding@resend.dev>";
  const resend = getResendClient(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  if (error) {
    throw new Error(`Failed to send email via Resend: ${error.message}`);
  }
  return { sent: true };
}
