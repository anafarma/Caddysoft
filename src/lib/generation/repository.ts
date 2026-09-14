import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/src/lib/db";
import { generations, generationVersions, projects, providers } from "@/src/lib/db/schema";

export async function createQueuedGeneration(userId: string, input: {
  projectId: string;
  sceneId: string;
  providerId: string;
  model: string;
  promptSnapshot: string;
  requestConfig: Record<string, unknown>;
}) {
  const project = (await getDb().select().from(projects).where(and(
    eq(projects.id, input.projectId),
    eq(projects.userId, userId),
    eq(projects.status, "ACTIVE"),
  )).limit(1))[0];
  if (!project) throw new Error("PROJECT_NOT_FOUND");

  const provider = (await getDb().select().from(providers).where(and(
    eq(providers.id, input.providerId),
    eq(providers.enabled, true),
  )).limit(1))[0];
  if (!provider) throw new Error("PROVIDER_NOT_AVAILABLE");

  const rows = await getDb().insert(generations).values({
    userId,
    projectId: input.projectId,
    sceneId: input.sceneId,
    providerId: input.providerId,
    model: input.model.trim(),
    status: "QUEUED",
    promptSnapshot: input.promptSnapshot,
    requestConfig: input.requestConfig,
  }).returning();
  if (!rows[0]) throw new Error("GENERATION_CREATE_FAILED");
  return rows[0];
}

export async function getGeneration(userId: string, generationId: string) {
  const rows = await getDb().select().from(generations).where(and(eq(generations.id, generationId), eq(generations.userId, userId))).limit(1);
  return rows[0] ?? null;
}

export async function markGenerationStarted(userId: string, generationId: string, providerAccountId: string) {
  const rows = await getDb().update(generations).set({
    status: "GENERATING", providerAccountId, startedAt: new Date(), updatedAt: new Date(),
  }).where(and(eq(generations.id, generationId), eq(generations.userId, userId), eq(generations.status, "QUEUED"))).returning();
  return rows[0] ?? null;
}

export async function setProviderOperation(userId: string, generationId: string, operationId: string) {
  const rows = await getDb().update(generations).set({ providerOperationId: operationId, updatedAt: new Date() })
    .where(and(eq(generations.id, generationId), eq(generations.userId, userId))).returning();
  return rows[0] ?? null;
}

export async function completeGeneration(userId: string, generationId: string, actualCost?: string | null) {
  const rows = await getDb().update(generations).set({
    status: "COMPLETED", actualCost: actualCost ?? null, completedAt: new Date(), updatedAt: new Date(),
  }).where(and(
    eq(generations.id, generationId),
    eq(generations.userId, userId),
    eq(generations.status, "GENERATING"),
  )).returning();
  return rows[0] ?? null;
}

export async function failGeneration(userId: string, generationId: string, errorCode: string, errorMessage: string) {
  const rows = await getDb().update(generations).set({
    status: "FAILED", errorCode: errorCode.slice(0, 100), errorMessage: errorMessage.slice(0, 2000), completedAt: new Date(), updatedAt: new Date(),
  }).where(and(
    eq(generations.id, generationId),
    eq(generations.userId, userId),
    sql`${generations.status} IN ('QUEUED', 'GENERATING')`,
  )).returning();
  return rows[0] ?? null;
}

export async function createGenerationVersion(generationId: string, requestSnapshot: Record<string, unknown>, responseSnapshot?: Record<string, unknown>, outputAssetId?: string) {
  const latest = await getDb().select({ max: sql<number>`COALESCE(MAX(version_number), 0)` }).from(generationVersions).where(eq(generationVersions.generationId, generationId));
  const versionNumber = Number(latest[0]?.max ?? 0) + 1;
  const rows = await getDb().insert(generationVersions).values({
    generationId, versionNumber, requestSnapshot, responseSnapshot: responseSnapshot ?? null, outputAssetId: outputAssetId ?? null,
  }).onConflictDoNothing({ target: [generationVersions.generationId, generationVersions.versionNumber] }).returning();
  if (rows[0]) return rows[0];

  const existing = await getDb().select().from(generationVersions)
    .where(and(eq(generationVersions.generationId, generationId), eq(generationVersions.versionNumber, versionNumber)))
    .limit(1);
  return existing[0] ?? null;
}

export async function listGenerationVersions(generationId: string) {
  return getDb().select().from(generationVersions).where(eq(generationVersions.generationId, generationId)).orderBy(desc(generationVersions.versionNumber));
}
