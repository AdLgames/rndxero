import type { PrismaClient } from "@/lib/generated/prisma/client";
import { signToken, verifyToken } from "@/lib/auth/tokens";

export const SESSION_COOKIE_NAME = "claimtrail_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000; // 15 minutes

function requireAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

export function createSessionCookieValue(userId: string): string {
  return signToken({ userId, expiresAt: Date.now() + SESSION_TTL_MS }, requireAuthSecret());
}

export function readSessionUserId(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null;
  const payload = verifyToken<{ userId: string }>(cookieValue, requireAuthSecret());
  return payload?.userId ?? null;
}

export function createMagicLinkToken(email: string): string {
  return signToken({ email, expiresAt: Date.now() + MAGIC_LINK_TTL_MS }, requireAuthSecret());
}

export function readMagicLinkEmail(token: string): string | null {
  const payload = verifyToken<{ email: string }>(token, requireAuthSecret());
  return payload?.email ?? null;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  memberships: Array<{ role: string; companyId: string }>;
}

export async function getCurrentUser(
  prisma: PrismaClient,
  cookieValue: string | undefined
): Promise<CurrentUser | null> {
  const userId = readSessionUserId(cookieValue);
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { memberships: { select: { role: true, companyId: true } } },
  });
  return user;
}
