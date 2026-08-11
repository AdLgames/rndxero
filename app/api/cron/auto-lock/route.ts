import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { autoLockOverdueSubmissions } from "@/lib/locking/repository";

/**
 * Auto-lock at close + 7 days (BOARD-PLAN.md Phase 0 decision #4).
 * Intended to run daily via Vercel Cron (see vercel.json), which invokes
 * this with GET — protected by a shared secret rather than session auth,
 * since nothing is signed in when a cron job fires. Vercel automatically
 * sends `Authorization: Bearer $CRON_SECRET` for cron-triggered requests
 * when CRON_SECRET is set as a project env var.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await autoLockOverdueSubmissions(prisma);
  return NextResponse.json(result);
}
