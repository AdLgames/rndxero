/**
 * UK first-time (or previously-lapsed) claimants must notify HMRC of an
 * intention to claim within 6 months of the accounting period's end —
 * miss it and the claim can't be made at all, regardless of how good the
 * evidence is. Pure date arithmetic, no HMRC-guidance judgement involved.
 */
export function claimNotificationDeadline(periodEndDate: Date): Date {
  const year = periodEndDate.getUTCFullYear();
  const month = periodEndDate.getUTCMonth();
  const day = periodEndDate.getUTCDate();
  // Clamp to the target month's last day when the original day doesn't exist
  // there (31 March + 6 months lands on 30 September, not 1 October) — plain
  // Date month arithmetic overflows into the next month instead of clamping.
  const targetMonthLastDay = new Date(Date.UTC(year, month + 7, 0)).getUTCDate();
  return new Date(Date.UTC(year, month + 6, Math.min(day, targetMonthLastDay)));
}

export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.floor((date.getTime() - now.getTime()) / 86_400_000);
}
