import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getIsoWeekKey, shiftWeekKey } from "@/lib/capture/week-key";
import { getNudgeCandidates } from "@/lib/notifications/weekly-nudge";
import { sendEmail } from "@/lib/email/send";
import { buildWeeklyNudgeEmail } from "@/lib/email/templates";

/**
 * Weekly nudge, sent on the week-close day (BOARD-PLAN.md Phase 8.3),
 * deep-linked so every project still needing a submission is already
 * prefilled on arrival (the capture page shows all accessible projects
 * for a week by default — no per-project param needed). Same GET +
 * CRON_SECRET convention as /api/cron/auto-lock, since nothing is signed
 * in when Vercel Cron fires this.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const justClosedWeekKey = shiftWeekKey(getIsoWeekKey(new Date()), -1);
  const candidates = await getNudgeCandidates(prisma, justClosedWeekKey);

  let sent = 0;
  for (const candidate of candidates) {
    const link = `${request.nextUrl.origin}/capture?week=${justClosedWeekKey}`;
    try {
      await sendEmail({
        to: candidate.email,
        ...buildWeeklyNudgeEmail({ link, weekKey: justClosedWeekKey, missingProjectNames: candidate.missingProjectNames }),
      });
      sent++;
    } catch (error) {
      console.error(`Failed to send weekly nudge to ${candidate.email}`, error);
    }
  }

  return NextResponse.json({ weekKey: justClosedWeekKey, candidateCount: candidates.length, sent });
}
