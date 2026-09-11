import { and, eq } from "drizzle-orm";
import { getDb } from "@/src/lib/db";
import { usageEvents } from "@/src/lib/db/schema";

export async function recordUsage(input: {
  userId: string;
  providerAccountId?: string | null;
  generationId?: string | null;
  jobId?: string | null;
  model: string;
  units?: number | null;
  cost?: string | null;
  status: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}) {
  const existing = await getDb().select().from(usageEvents).where(and(
    eq(usageEvents.userId, input.userId),
    eq(usageEvents.metadata, { ...input.metadata, idempotencyKey: input.idempotencyKey }),
  )).limit(1).catch(() => []);
  if (existing[0]) return existing[0];

  const rows = await getDb().insert(usageEvents).values({
    userId: input.userId, providerAccountId: input.providerAccountId ?? null,
    generationId: input.generationId ?? null, jobId: input.jobId ?? null,
    model: input.model, units: input.units ?? null, cost: input.cost ?? null,
    status: input.status, metadata: { ...input.metadata, idempotencyKey: input.idempotencyKey },
  }).returning();
  return rows[0] ?? null;
}
