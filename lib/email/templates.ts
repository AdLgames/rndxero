/**
 * Pure email content builders — no network, no Resend dependency. Kept
 * separate from lib/email/send.ts so the copy can be unit tested without
 * a live API key.
 */

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const LINK_EXPIRY_COPY = "This link expires in 15 minutes. If you didn't request it, you can ignore this email.";

export function buildMagicLinkEmail(params: { link: string; context: "sign-in" | "signup" }): EmailContent {
  const isSignup = params.context === "signup";
  const subject = isSignup ? "Confirm your ClaimTrail company" : "Sign in to ClaimTrail";
  const cta = isSignup ? "Confirm and sign in" : "Sign in";

  const text = `${cta}: ${params.link}\n\n${LINK_EXPIRY_COPY}`;
  const html = `
    <p>${isSignup ? "One click to confirm your new company and sign in." : "Click below to sign in to ClaimTrail."}</p>
    <p><a href="${params.link}">${cta}</a></p>
    <p style="color:#666;font-size:13px;">${LINK_EXPIRY_COPY}</p>
  `.trim();

  return { subject, html, text };
}

export function buildInvitationEmail(params: {
  link: string;
  companyName: string;
  inviterName: string;
}): EmailContent {
  const subject = `${params.inviterName} invited you to ${params.companyName} on ClaimTrail`;
  const text = `${params.inviterName} invited you to join ${params.companyName} on ClaimTrail.\n\nAccept: ${params.link}\n\nThis invitation expires in 7 days.`;
  const html = `
    <p>${params.inviterName} invited you to join <strong>${params.companyName}</strong> on ClaimTrail.</p>
    <p><a href="${params.link}">Accept invitation</a></p>
    <p style="color:#666;font-size:13px;">This invitation expires in 7 days.</p>
  `.trim();

  return { subject, html, text };
}
