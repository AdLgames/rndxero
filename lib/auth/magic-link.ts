import type { PrismaClient, User } from "@/lib/generated/prisma/client";
import { canSendMagicLink } from "@/lib/auth/rate-limit";
import { createMagicLinkToken } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/send";
import { buildMagicLinkEmail } from "@/lib/email/templates";

/**
 * The one place that actually sends a sign-in/signup-confirmation email —
 * both API routes go through this so the cooldown check and the
 * lastMagicLinkSentAt update can't drift apart between them. Silently
 * skips sending (returns sent: false) inside the cooldown window rather
 * than erroring, since a suppressed repeat isn't a failure from the
 * caller's point of view — the first email is already on its way.
 */
export async function sendMagicLinkIfAllowed(
  prisma: PrismaClient,
  user: User,
  params: { origin: string; context: "sign-in" | "signup" }
): Promise<{ sent: boolean }> {
  if (!canSendMagicLink(user.lastMagicLinkSentAt)) {
    return { sent: false };
  }

  const token = createMagicLinkToken(user.email);
  const link = `${params.origin}/api/auth/callback?token=${encodeURIComponent(token)}`;
  await sendEmail({ to: user.email, ...buildMagicLinkEmail({ link, context: params.context }) });

  await prisma.user.update({ where: { id: user.id }, data: { lastMagicLinkSentAt: new Date() } });
  return { sent: true };
}
