import { head } from "@vercel/blob";
import { NextResponse } from "next/server";
import { requireAppUser } from "@/src/lib/auth/current-app-user";
import { completeDerivative, getAssetDerivative } from "@/src/lib/assets/derivatives";

export async function POST(request: Request, context: { params: Promise<{ assetId: string; derivativeId: string }> }) {
  try {
    const user = await requireAppUser();
    const { derivativeId } = await context.params;
    const body = await request.json().catch(() => null);
    const metadata = body && typeof body === "object" && body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? body.metadata
      : {};

    const current = await getAssetDerivative(user.id, derivativeId);
    if (!current) return NextResponse.json({ error: "DERIVATIVE_NOT_FOUND" }, { status: 404 });

    const blob = await head(current.derivative.storageKey);
    const record = await completeDerivative(user.id, derivativeId, {
      mimeType: blob.contentType || current.derivative.mimeType,
      byteSize: blob.size,
      width: typeof metadata.width === "number" ? metadata.width : null,
      height: typeof metadata.height === "number" ? metadata.height : null,
      durationMs: typeof metadata.durationMs === "number" ? metadata.durationMs : null,
      metadata: { ...current.derivative.metadata, ...metadata, uploadState: "READY", blobEtag: blob.etag },
    });

    return NextResponse.json({ data: record });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "DERIVATIVE_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
