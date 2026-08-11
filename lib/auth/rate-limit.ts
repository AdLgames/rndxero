/**
 * Guards against sending duplicate magic-link emails. A slow response
 * (cold start + email round trip) plus an anxious re-click, a reload, or
 * a second tab can all fire the same request more than once — this
 * makes repeats within the cooldown a no-op instead of another email,
 * regardless of what caused the repeat.
 */
const MAGIC_LINK_COOLDOWN_MS = 60_000;

export function canSendMagicLink(
  lastSentAt: Date | null,
  now: Date = new Date(),
  cooldownMs: number = MAGIC_LINK_COOLDOWN_MS
): boolean {
  if (!lastSentAt) return true;
  return now.getTime() - lastSentAt.getTime() >= cooldownMs;
}
