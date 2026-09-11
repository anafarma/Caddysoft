import { head } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireAppUser } from "@/src/lib/auth/current-app-user";
import { completeAsset, getAsset } from "@/src/lib/db/repositories";

export async function POST(request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const user = await requireAppUser();
    const { assetId } = await context.params;
    const asset = await getAsset(user.id, assetId);
    if (!asset) return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });

    const blob = await head(asset.storageKey, { access: "private" });
    const body = await request.json().catch(() => null);
    const metadata = body && typeof body === "object" && body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? body.metadata
      : {};

    const record = await completeAsset(user.id, assetId, {
      mimeType: blob.contentType || asset.mimeType,
      byteSize: blob.size,
      metadata: { ...metadata, uploadState: "READY", blobEtag: blob.etag },
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "ASSET_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
