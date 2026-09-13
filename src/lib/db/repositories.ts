import { desc, eq, and, isNull, lt, isNotNull, sql } from "drizzle-orm";
import { getDb } from "./index";
import { assets, projects, scenes, assetKind } from "./schema";
import type { Asset } from "./schema";

export async function listProjects(userId: string) {
  return getDb().select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt));
}

export async function createProject(userId: string, input: { name: string; description?: string | null }) {
  const name = input.name.trim();
  if (!name || name.length > 120) throw new Error("INVALID_PROJECT_NAME");
  const description = input.description?.trim() || null;
  if (description && description.length > 2000) throw new Error("INVALID_PROJECT_DESCRIPTION");
  const rows = await getDb().insert(projects).values({ userId, name, description }).returning();
  if (!rows[0]) throw new Error("PROJECT_CREATE_FAILED");
  return rows[0];
}

export async function getProject(userId: string, projectId: string) {
  const rows = await getDb().select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  return rows[0] ?? null;
}

export async function listScenes(userId: string, projectId: string) {
  const project = await getProject(userId, projectId);
  if (!project) return null;
  return getDb().select().from(scenes).where(eq(scenes.projectId, projectId)).orderBy(scenes.position);
}

const ASSET_KINDS = ["IMAGE", "VIDEO", "AUDIO", "CHARACTER", "LOCATION", "LOGO", "REFERENCE", "OTHER"] as const;
type AssetKind = (typeof ASSET_KINDS)[number];

export type CreateAssetInput = {
  projectId?: string | null;
  kind?: AssetKind;
  name: string;
  storageKey: string;
  mimeType?: string | null;
  byteSize?: number | null;
  durationMs?: number | null;
  width?: number | null;
  height?: number | null;
  metadata?: Record<string, unknown>;
};

function validateNonNegative(value: number | null | undefined, code: string) {
  if (value != null && (!Number.isSafeInteger(value) || value < 0)) throw new Error(code);
}

export async function listAssets(userId: string, filters: { projectId?: string | null; kind?: AssetKind | null } = {}): Promise<Asset[]> {
  const conditions = [eq(assets.userId, userId), isNull(assets.deletedAt)];
  if (filters.projectId) conditions.push(eq(assets.projectId, filters.projectId));
  if (filters.kind) conditions.push(eq(assets.kind, filters.kind));
  return getDb().select().from(assets).where(and(...conditions)).orderBy(desc(assets.createdAt));
}

export async function getAsset(userId: string, assetId: string) {
  const rows = await getDb().select().from(assets).where(and(eq(assets.id, assetId), eq(assets.userId, userId), isNull(assets.deletedAt))).limit(1);
  return rows[0] ?? null;
}

export async function getAssetByStorageKey(userId: string, storageKey: string) {
  const rows = await getDb().select().from(assets).where(and(eq(assets.userId, userId), eq(assets.storageKey, storageKey))).limit(1);
  return rows[0] ?? null;
}

export async function restoreAssetForOutput(userId: string, assetId: string, input: {
  mimeType?: string | null;
  byteSize?: number | null;
  metadata?: Record<string, unknown>;
}) {
  validateNonNegative(input.byteSize, "INVALID_BYTE_SIZE");
  if (input.mimeType && input.mimeType.length > 255) throw new Error("INVALID_MIME_TYPE");
  const rows = await getDb().update(assets).set({
    deletedAt: null,
    mimeType: input.mimeType ?? undefined,
    byteSize: input.byteSize ?? undefined,
    metadata: input.metadata ?? undefined,
    updatedAt: new Date(),
  }).where(and(eq(assets.id, assetId), eq(assets.userId, userId))).returning();
  if (!rows[0]) throw new Error("ASSET_UPDATE_FAILED");
  return rows[0];
}

export async function createAsset(userId: string, input: CreateAssetInput) {
  const name = input.name.trim();
  const storageKey = input.storageKey.trim();
  if (!name || name.length > 200) throw new Error("INVALID_ASSET_NAME");
  if (!storageKey || storageKey.length > 1000) throw new Error("INVALID_STORAGE_KEY");
  if (!storageKey.startsWith(`users/${userId}/`)) throw new Error("INVALID_STORAGE_KEY");
  if (!input.kind || !ASSET_KINDS.includes(input.kind)) throw new Error("INVALID_ASSET_KIND");
  if (input.mimeType && input.mimeType.length > 255) throw new Error("INVALID_MIME_TYPE");
  validateNonNegative(input.byteSize, "INVALID_BYTE_SIZE");
  validateNonNegative(input.durationMs, "INVALID_DURATION");
  validateNonNegative(input.width, "INVALID_WIDTH");
  validateNonNegative(input.height, "INVALID_HEIGHT");
  if (input.projectId && !(await getProject(userId, input.projectId))) throw new Error("PROJECT_NOT_FOUND");

  const rows = await getDb().insert(assets).values({
    userId,
    projectId: input.projectId ?? null,
    kind: input.kind,
    name,
    storageKey,
    mimeType: input.mimeType ?? null,
    byteSize: input.byteSize ?? null,
    durationMs: input.durationMs ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    metadata: input.metadata ?? {},
  }).returning();
  if (!rows[0]) throw new Error("ASSET_CREATE_FAILED");
  return rows[0];
}

export async function completeAsset(userId: string, assetId: string, input: {
  mimeType?: string | null;
  byteSize?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const asset = await getAsset(userId, assetId);
  if (!asset) throw new Error("ASSET_NOT_FOUND");

  validateNonNegative(input.byteSize, "INVALID_BYTE_SIZE");
  if (input.mimeType && input.mimeType.length > 255) throw new Error("INVALID_MIME_TYPE");

  const rows = await getDb().update(assets).set({
    mimeType: input.mimeType ?? asset.mimeType,
    byteSize: input.byteSize ?? asset.byteSize,
    metadata: input.metadata ?? asset.metadata,
    updatedAt: new Date(),
  }).where(and(eq(assets.id, assetId), eq(assets.userId, userId), isNull(assets.deletedAt))).returning();

  if (!rows[0]) throw new Error("ASSET_UPDATE_FAILED");
  return rows[0];
}

export async function listStalePendingAssets(before: Date, limit = 100) {
  return getDb().select().from(assets)
    .where(and(
      isNull(assets.deletedAt),
      lt(assets.createdAt, before),
      sql`COALESCE(${assets.metadata}->>'uploadState', '') = 'PENDING'`,
    ))
    .orderBy(assets.createdAt)
    .limit(limit);
}

export async function listDeletedAssets(before: Date, limit = 100) {
  return getDb().select().from(assets)
    .where(and(
      isNotNull(assets.deletedAt),
      lt(assets.deletedAt, before),
      sql`COALESCE(${assets.metadata}->>'storageDeletedAt', '') = ''`,
    ))
    .orderBy(assets.deletedAt)
    .limit(limit);
}

export async function markAssetDeleted(assetId: string) {
  const rows = await getDb().update(assets)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
      metadata: sql`jsonb_set(${assets.metadata}, '{uploadState}', '"DELETED"'::jsonb, true)`,
    })
    .where(and(eq(assets.id, assetId), isNull(assets.deletedAt)))
    .returning({ id: assets.id });
  return Boolean(rows[0]);
}

export async function markAssetStorageDeleted(assetId: string) {
  const rows = await getDb().update(assets)
    .set({
      updatedAt: new Date(),
      metadata: sql`jsonb_set(${assets.metadata}, '{storageDeletedAt}', to_jsonb(${new Date().toISOString()}::text), true)`,
    })
    .where(eq(assets.id, assetId))
    .returning({ id: assets.id });
  return Boolean(rows[0]);
}

export { ASSET_KINDS, assetKind };