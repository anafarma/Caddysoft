import { NextResponse } from "next/server";
import { getAssetStorageAdapter } from "@/src/lib/assets/storage";
import { listDeletedAssets, listStalePendingAssets, markAssetDeleted } from "@/src/lib/db/repositories";

const PENDING_RETENTION_MS = 24 * 60 * 60 * 1000;
const DELETED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 100;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return new NextResponse("Unauthorized", { status: 401 });

  const adapter = getAssetStorageAdapter();
  const now = Date.now();
  const pendingBefore = new Date(now - PENDING_RETENTION_MS);
  const deletedBefore = new Date(now - DELETED_RETENTION_MS);

  let pendingScanned = 0;
  let pendingMarkedDeleted = 0;
  let deletedScanned = 0;
  let storageDeleteFailures = 0;

  const stalePending = await listStalePendingAssets(pendingBefore, BATCH_SIZE);
  for (const asset of stalePending) {
    pendingScanned++;
    try {
      await adapter.deleteObject({ storageKey: asset.storageKey });
    } catch (error) {
      storageDeleteFailures++;
      console.error("ASSET_PENDING_STORAGE_DELETE_FAILED", asset.id, error);
      continue;
    }
    if (await markAssetDeleted(asset.id)) pendingMarkedDeleted++;
  }

  const deletedAssets = await listDeletedAssets(deletedBefore, BATCH_SIZE);
  for (const asset of deletedAssets) {
    deletedScanned++;
    try {
      await adapter.deleteObject({ storageKey: asset.storageKey });
    } catch (error) {
      storageDeleteFailures++;
      console.error("ASSET_DELETED_STORAGE_DELETE_FAILED", asset.id, error);
    }
  }

  return NextResponse.json({
    ok: true,
    pending: { scanned: pendingScanned, markedDeleted: pendingMarkedDeleted },
    deleted: { scanned: deletedScanned },
    storageDeleteFailures,
  });
}
