import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/src/lib/db";
import { jobs } from "@/src/lib/db/schema";
import type { JobPayload, JobType } from "./types";

export async function enqueueJob(userId: string, input: {
  type: JobType;
  idempotencyKey: string;
  payload: JobPayload;
  projectId?: string | null;
  generationId?: string | null;
  providerAccountId?: string | null;
  maxAttempts?: number;
}) {
  if (!input.idempotencyKey || input.idempotencyKey.length > 255) throw new Error("INVALID_IDEMPOTENCY_KEY");
  const existing = await getDb().select().from(jobs).where(and(eq(jobs.userId, userId), eq(jobs.idempotencyKey, input.idempotencyKey))).limit(1);
  if (existing[0]) return existing[0];

  const rows = await getDb().insert(jobs).values({
    userId, projectId: input.projectId ?? null, generationId: input.generationId ?? null,
    providerAccountId: input.providerAccountId ?? null, type: input.type, status: "QUEUED",
    idempotencyKey: input.idempotencyKey, maxAttempts: Math.min(10, Math.max(1, input.maxAttempts ?? 3)),
    payload: input.payload,
  }).onConflictDoNothing().returning();

  if (rows[0]) return rows[0];
  const retry = await getDb().select().from(jobs).where(and(eq(jobs.userId, userId), eq(jobs.idempotencyKey, input.idempotencyKey))).limit(1);
  if (!retry[0]) throw new Error("JOB_ENQUEUE_FAILED");
  return retry[0];
}

export async function claimNextJob() {
  const result = await getDb().execute(sql`
    UPDATE jobs
    SET status = 'RUNNING', locked_at = now(), started_at = COALESCE(started_at, now()), updated_at = now()
    WHERE id = (
      SELECT id FROM jobs
      WHERE status IN ('QUEUED', 'RETRYING') AND available_at <= now()
      ORDER BY available_at, created_at
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING *
  `);
  return result.rows[0] ?? null;
}

export async function succeedJob(jobId: string) {
  const rows = await getDb().update(jobs).set({ status: "SUCCEEDED", finishedAt: new Date(), lockedAt: null, updatedAt: new Date() }).where(and(eq(jobs.id, jobId), eq(jobs.status, "RUNNING"))).returning();
  return rows[0] ?? null;
}

export async function failJob(jobId: string, errorCode: string, errorMessage: string, retry = true) {
  const rows = await getDb().update(jobs).set({
    status: retry ? "RETRYING" : "FAILED",
    attempt: retry ? sql`LEAST(max_attempts, attempt + 1)` : jobs.attempt,
    availableAt: retry ? sql`now() + (LEAST(3600, POWER(2, GREATEST(0, attempt - 1)) * 30) || ' seconds')::interval` : jobs.availableAt,
    errorCode: errorCode.slice(0, 100), errorMessage: errorMessage.slice(0, 2000),
    finishedAt: retry ? null : new Date(), lockedAt: null, updatedAt: new Date(),
  }).where(eq(jobs.id, jobId)).returning();
  return rows[0] ?? null;
}
