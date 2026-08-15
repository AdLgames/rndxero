import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { processPendingDeletions } from "@/lib/gdpr/deletion";

/**
 * Anonymizes any account whose GDPR erasure request has cleared its
 * grace period (lib/gdpr/deletion.ts). Same shape as
 * /api/cron/auto-lock: driven by Vercel Cron (see vercel.json), no
 * session auth since nothing is signed in when a cron job fires.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processPendingDeletions(prisma);
  return NextResponse.json(result);
}
