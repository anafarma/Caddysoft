import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAppUser } from "@/src/lib/auth/current-app-user";
import { getAssetStorageAdapter } from "@/src/lib/assets/storage";
import { createAsset } from "@/src/lib/db/repositories";

const ASSET_KINDS = ["IMAGE", "VIDEO", "AUDIO", "CHARACTER", "LOCATION", "LOGO", "REFERENCE", "OTHER"] as const;

type AssetKind = (typeof ASSET_KINDS)[number];

function isAssetKind(value: unknown): value is AssetKind {
  return typeof value === "string" && (ASSET_KINDS as readonly string[]).includes(value);
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120) || "asset";
}

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const kind = isAssetKind(body.kind) ? body.kind : undefined;
    const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : null;
    const byteSize = typeof body.byteSize === "number" ? body.byteSize : null;
    const projectId = typeof body.projectId === "string" ? body.projectId : null;

    if (!name || !kind || !mimeType) {
      return NextResponse.json({ error: "INVALID_UPLOAD_REQUEST" }, { status: 400 });
    }
    if (byteSize != null && (!Number.isSafeInteger(byteSize) || byteSize < 0)) {
      return NextResponse.json({ error: "INVALID_BYTE_SIZE" }, { status: 400 });
    }

    const storageKey = `users/${user.id}/assets/${randomUUID()}-${sanitizeFileName(name)}`;
    const asset = await createAsset(user.id, {
      projectId,
      kind,
      name,
      storageKey,
      mimeType,
      byteSize,
      metadata: { uploadState: "PENDING" },
    });

    try {
      const upload = await getAssetStorageAdapter().createUploadUrl({
        assetId: asset.id,
        storageKey: asset.storageKey,
        contentType: mimeType,
        byteSize: byteSize ?? undefined,
      });

      return NextResponse.json({ data: { asset, ...upload } }, { status: 201 });
    } catch (error) {
      // The DB row is retained so the failed preparation is observable and can be cleaned up later.
      console.error("ASSET_UPLOAD_URL_CREATE_FAILED", error);
      return NextResponse.json({ error: "ASSET_UPLOAD_PREPARATION_FAILED", assetId: asset.id }, { status: 503 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : message.startsWith("INVALID_") ? 400 : message === "PROJECT_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
