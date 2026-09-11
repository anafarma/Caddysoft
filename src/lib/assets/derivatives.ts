import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/src/lib/db";
import { assetDerivatives, assets } from "@/src/lib/db/schema";

export const DERIVATIVE_KINDS = ["THUMBNAIL", "POSTER", "WAVEFORM"] as const;
export type DerivativeKind = (typeof DERIVATIVE_KINDS)[number];

export function isDerivativeKind(value: unknown): value is DerivativeKind {
  return typeof value === "string" && (DERIVATIVE_KINDS as readonly string[]).includes(value);
}

export async function getOwnedAsset(userId: string, assetId: string) {
  const rows = await getDb().select().from(assets).where(and(
    eq(assets.id, assetId),
    eq(assets.userId, userId),
    isNull(assets.deletedAt),
  )).limit(1);
  return rows[0] ?? null;
}

export async function listAssetDerivatives(userId: string, assetId: string) {
  const source = await getOwnedAsset(userId, assetId);
  if (!source) return null;
  return getDb().select().from(assetDerivatives)
    .where(and(eq(assetDerivatives.assetId, assetId), isNull(assetDerivatives.deletedAt)))
    .orderBy(desc(assetDerivatives.createdAt));
}

export async function getAssetDerivative(userId: string, derivativeId: string) {
  const rows = await getDb().select({
    derivative: assetDerivatives,
    asset: assets,
  }).from(assetDerivatives)
    .innerJoin(assets, eq(assetDerivatives.assetId, assets.id))
    .where(and(
      eq(assetDerivatives.id, derivativeId),
      eq(assets.userId, userId),
      isNull(assets.deletedAt),
      isNull(assetDerivatives.deletedAt),
    )).limit(1);
  return rows[0] ?? null;
}

export async function createDerivative(userId: string, assetId: string, input: {
  kind: DerivativeKind;
  storageKey: string;
  mimeType?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const source = await getOwnedAsset(userId, assetId);
  if (!source) throw new Error("ASSET_NOT_FOUND");

  const existing = await getDb().select().from(assetDerivatives).where(and(
    eq(assetDerivatives.assetId, assetId),
    eq(assetDerivatives.kind, input.kind),
    isNull(assetDerivatives.deletedAt),
  )).limit(1);
  if (existing[0]) return existing[0];

  const rows = await getDb().insert(assetDerivatives).values({
    assetId,
    kind: input.kind,
    status: "PENDING",
    storageKey: input.storageKey,
    mimeType: input.mimeType ?? null,
    metadata: input.metadata ?? {},
  }).returning();

  if (!rows[0]) throw new Error("DERIVATIVE_CREATE_FAILED");
  return rows[0];
}

export async function completeDerivative(userId: string, derivativeId: string, input: {
  mimeType?: string | null;
  byteSize?: number | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const current = await getAssetDerivative(userId, derivativeId);
  if (!current) throw new Error("DERIVATIVE_NOT_FOUND");

  const rows = await getDb().update(assetDerivatives).set({
    status: "READY",
    mimeType: input.mimeType ?? current.derivative.mimeType,
    byteSize: input.byteSize ?? current.derivative.byteSize,
    width: input.width ?? current.derivative.width,
    height: input.height ?? current.derivative.height,
    durationMs: input.durationMs ?? current.derivative.durationMs,
    metadata: input.metadata ?? current.derivative.metadata,
    updatedAt: new Date(),
  }).where(and(
    eq(assetDerivatives.id, derivativeId),
    eq(assetDerivatives.assetId, current.asset.id),
    isNull(assetDerivatives.deletedAt),
  )).returning();

  if (!rows[0]) throw new Error("DERIVATIVE_COMPLETE_FAILED");
  return rows[0];
}

export async function failDerivative(userId: string, derivativeId: string, errorMessage: string) {
  const current = await getAssetDerivative(userId, derivativeId);
  if (!current) throw new Error("DERIVATIVE_NOT_FOUND");

  const rows = await getDb().update(assetDerivatives).set({
    status: "FAILED",
    metadata: { ...current.derivative.metadata, error: errorMessage.slice(0, 1000) },
    updatedAt: new Date(),
  }).where(eq(assetDerivatives.id, derivativeId)).returning();
  return rows[0] ?? null;
}
