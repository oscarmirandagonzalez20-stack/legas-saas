/**
 * Integration tests for the atomic claim logic in CommentIngestionService.
 * These tests hit the real PostgreSQL database (DATABASE_URL_DIRECT).
 *
 * Validates:
 *  1. Crash-recovery: zombie PROCESSING row is reclaimed after stale threshold
 *  2. Concurrency: two concurrent claims → only one wins the UPDATE ... RETURNING
 *  3. State invariant: PROCESSED row is never reclaimed
 *  4. State invariant: FAILED row is never reclaimed automatically
 *  5. First-time claim: new event inserted and claimed in one round-trip pair
 */

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { STALE_PROCESSING_THRESHOLD_MS } from './comment-ingestion.service';

// Use the direct (non-RLS) connection so tests are not filtered by tenant context.
// inbound_events has no tenant_id, so app_user would also work — direct is safer.
const DB_URL = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;

// ── fixture helpers ───────────────────────────────────────────────────────────

const SOURCE = 'meta-webhook';

/** Inserts an inbound_events row with explicit status for test setup. */
async function seedRow(
  prisma: PrismaClient,
  externalId: string,
  status: 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED',
  processingStartedAt?: Date,
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO inbound_events
      (id, source, external_id, payload, status, processing_started_at, received_at, updated_at)
    VALUES (
      gen_random_uuid(),
      ${SOURCE},
      ${externalId},
      '{}',
      ${status}::"InboundEventStatus",
      ${processingStartedAt ?? null},
      NOW(),
      NOW()
    )
  `;
}

/** Runs Phase 2 of the claim: UPDATE ... WHERE RECEIVED OR zombie RETURNING id */
async function runClaim(prisma: PrismaClient, externalId: string): Promise<string[]> {
  const staleCutoff = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE inbound_events
    SET
      status              = 'PROCESSING'::"InboundEventStatus",
      processing_started_at = NOW(),
      updated_at          = NOW()
    WHERE source       = ${SOURCE}
      AND external_id  = ${externalId}
      AND (
        status = 'RECEIVED'::"InboundEventStatus"
        OR (
          status = 'PROCESSING'::"InboundEventStatus"
          AND processing_started_at < ${staleCutoff}
        )
      )
    RETURNING id
  `;
  return rows.map((r) => r.id);
}

// ── suite ─────────────────────────────────────────────────────────────────────

describe('CommentIngestionService — claim SQL (integration)', () => {
  let prisma: PrismaClient;
  const seededKeys: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: { db: { url: DB_URL } },
    });
    await prisma.$connect();
  });

  afterEach(async () => {
    if (seededKeys.length === 0) return;
    await prisma.$executeRaw`
      DELETE FROM inbound_events
      WHERE source = ${SOURCE}
        AND external_id = ANY(${seededKeys})
    `;
    seededKeys.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // ── 1. First-time claim ────────────────────────────────────────────────────

  it('claims a fresh RECEIVED row on the first attempt', async () => {
    const key = `it:fresh-${String(Date.now())}`;
    seededKeys.push(key);

    await seedRow(prisma, key, 'RECEIVED');
    const claimed = await runClaim(prisma, key);

    expect(claimed).toHaveLength(1);

    const row = await prisma.inboundEvent.findUnique({
      where: { source_externalId: { source: SOURCE, externalId: key } },
      select: { status: true },
    });
    expect(row?.status).toBe('PROCESSING');
  });

  // ── 2. Crash-recovery: zombie reclaim ──────────────────────────────────────

  it('reclaims a zombie PROCESSING row older than the stale threshold', async () => {
    const key = `it:zombie-${String(Date.now())}`;
    seededKeys.push(key);

    // Simulate a worker that died: status=PROCESSING but started > threshold ago
    const staleTs = new Date(Date.now() - STALE_PROCESSING_THRESHOLD_MS - 60_000);
    await seedRow(prisma, key, 'PROCESSING', staleTs);

    const claimed = await runClaim(prisma, key);

    expect(claimed).toHaveLength(1);
  });

  it('does NOT claim a PROCESSING row that is still within the active window', async () => {
    const key = `it:active-${String(Date.now())}`;
    seededKeys.push(key);

    // Started just now — another worker has a valid claim
    const freshTs = new Date(Date.now() - 30_000); // 30 seconds ago
    await seedRow(prisma, key, 'PROCESSING', freshTs);

    const claimed = await runClaim(prisma, key);

    expect(claimed).toHaveLength(0);
  });

  // ── 3 & 4. State invariants ────────────────────────────────────────────────

  it('never reclaims a PROCESSED row', async () => {
    const key = `it:processed-${String(Date.now())}`;
    seededKeys.push(key);

    await seedRow(prisma, key, 'PROCESSED');
    const claimed = await runClaim(prisma, key);

    expect(claimed).toHaveLength(0);

    // Verify status is still PROCESSED (not mutated)
    const row = await prisma.inboundEvent.findUnique({
      where: { source_externalId: { source: SOURCE, externalId: key } },
      select: { status: true },
    });
    expect(row?.status).toBe('PROCESSED');
  });

  it('never reclaims a FAILED row automatically', async () => {
    const key = `it:failed-${String(Date.now())}`;
    seededKeys.push(key);

    await seedRow(prisma, key, 'FAILED');
    const claimed = await runClaim(prisma, key);

    expect(claimed).toHaveLength(0);

    const row = await prisma.inboundEvent.findUnique({
      where: { source_externalId: { source: SOURCE, externalId: key } },
      select: { status: true },
    });
    expect(row?.status).toBe('FAILED');
  });

  // ── 5. Concurrency: only one worker wins ──────────────────────────────────

  it('guarantees exactly one winner under concurrent claim attempts', async () => {
    const key = `it:race-${String(Date.now())}`;
    seededKeys.push(key);

    await seedRow(prisma, key, 'RECEIVED');

    // Use two independent PrismaClient connections to simulate two workers
    const prisma2 = new PrismaClient({ datasources: { db: { url: DB_URL } } });
    await prisma2.$connect();

    try {
      // Fire both claims at the same time — PostgreSQL row locking ensures exactly one wins
      const [r1, r2] = await Promise.all([
        runClaim(prisma, key),
        runClaim(prisma2, key),
      ]);

      const totalClaimed = r1.length + r2.length;
      expect(totalClaimed).toBe(1);
    } finally {
      await prisma2.$disconnect();
    }
  });

  // ── 6. No double-processing after PROCESSING (idempotency guard) ──────────

  it('second claim attempt on a just-claimed row returns skip', async () => {
    const key = `it:double-${String(Date.now())}`;
    seededKeys.push(key);

    await seedRow(prisma, key, 'RECEIVED');

    // First worker claims
    const first = await runClaim(prisma, key);
    expect(first).toHaveLength(1);

    // Same worker accidentally retries (or another worker arrives)
    const second = await runClaim(prisma, key);
    expect(second).toHaveLength(0);
  });
});
