import type { PrismaClient } from "@/lib/generated/prisma/client";
import { decryptToken } from "@/lib/xero/crypto";
import { fetchJournalsPage, mapJournalsToMirrorLines, type FetchFn } from "@/lib/xero/journals";

const PAGE_SIZE = 100;

/**
 * Resumable GL mirror backfill for one company. "Resumable" is this v1's
 * job queue: state lives in XeroSyncCursor, so re-invoking (from a cron
 * trigger, a manual "sync now" button, or a retried serverless
 * invocation) picks up exactly where the last run left off instead of
 * re-fetching from the start. A dedicated worker/queue (e.g. a persistent
 * BullMQ+Redis setup) is deferred until we're actually running a
 * long-lived process to host one — Vercel's serverless functions are the
 * Phase 1 deployment target, and this cursor-based approach gets the same
 * retry/resume guarantee without that extra infrastructure.
 */
export async function syncCompanyJournals(
  prisma: PrismaClient,
  companyId: string,
  fetchFn: FetchFn = fetch
): Promise<{ pagesFetched: number; linesUpserted: number }> {
  const connection = await prisma.xeroConnection.findUnique({ where: { companyId } });
  if (!connection) {
    throw new Error(`No Xero connection for company ${companyId}`);
  }

  const cursor = await prisma.xeroSyncCursor.upsert({
    where: { companyId },
    update: {},
    create: { companyId, lastJournalNumber: 0 },
  });

  const accessToken = decryptToken(connection.accessTokenEncrypted);
  let offset = cursor.lastJournalNumber;
  let pagesFetched = 0;
  let linesUpserted = 0;

  for (;;) {
    const page = await fetchJournalsPage(
      { tenantId: connection.tenantId, accessToken, offsetJournalNumber: offset },
      fetchFn
    );
    pagesFetched++;

    if (page.Journals.length === 0) break;

    const lines = mapJournalsToMirrorLines(companyId, page.Journals);
    for (const line of lines) {
      await prisma.xeroJournalLine.upsert({
        where: {
          companyId_xeroJournalLineId: {
            companyId: line.companyId,
            xeroJournalLineId: line.xeroJournalLineId,
          },
        },
        update: line,
        create: line,
      });
      linesUpserted++;
    }

    offset = Math.max(...page.Journals.map((j) => j.JournalNumber));
    await prisma.xeroSyncCursor.update({
      where: { companyId },
      data: { lastJournalNumber: offset },
    });

    if (page.Journals.length < PAGE_SIZE) break;
  }

  return { pagesFetched, linesUpserted };
}
