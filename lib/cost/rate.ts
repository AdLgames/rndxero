import type { Rate } from "@/lib/generated/prisma/client";

/**
 * The Rate covering `userId` at `atDate`, if any — shared by the
 * planner's derived-cost calculation (lib/plan/repository.ts) and the
 * claim pack export's actual-cost calculation (lib/export/pack.ts), both
 * of which need "what did this person cost per hour on this specific
 * week," never a single current figure. Picks the most recently started
 * rate when more than one covers the date (shouldn't normally happen —
 * Rate rows are time-boxed via effectiveFrom/effectiveTo — but this is
 * the sane tie-break if it does).
 */
export function findApplicableRate(rates: Rate[], userId: string, atDate: Date): Rate | undefined {
  return rates
    .filter((r) => r.userId === userId && r.effectiveFrom <= atDate && (r.effectiveTo === null || r.effectiveTo > atDate))
    .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime())[0];
}
