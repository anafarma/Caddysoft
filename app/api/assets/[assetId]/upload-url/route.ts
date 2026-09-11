import { NextResponse } from "next/server";
import { requireAppUser } from "@/src/lib/auth/current-app-user";
import { getAssetStorageAdapter } from "@/src/lib/assets/storage";
import { getDb } from "@/src/lib/db";
import { assets } from "@/src/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export async function POST(request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const user = await requireAppUser();
    const { assetId } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || typeof body.contentType !== "string" || !body.contentType.trim()) {
      return NextResponse.json({ error: "INVALID_UPLOAD_REQUEST" }, { status: 400 });
    }
    const rows = await getDb().select().from(assets).where(and(eq(assets.id, assetId), eq(assets.userId, user.id), isNull(assets.deletedAt))).limit(1);
    const asset = rows[0];
    if (!asset) return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });

    const result = await getAssetStorageAdapter().createUploadUrl({
      assetId: asset.id,
      storageKey: asset.storageKey,
      contentType: body.contentType.trim(),
      byteSize: typeof body.byteSize === "number" ? body.byteSize : undefined,
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}
