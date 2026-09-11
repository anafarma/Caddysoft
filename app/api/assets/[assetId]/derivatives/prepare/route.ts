import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAppUser } from "@/src/lib/auth/current-app-user";
import { createDerivative, isDerivativeKind } from "@/src/lib/assets/derivatives";
import { getAssetStorageAdapter } from "@/src/lib/assets/storage";

function safeKind(value: unknown) {
  return isDerivativeKind(value) ? value : null;
}

export async function POST(request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const user = await requireAppUser();
    const { assetId } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });

    const kind = safeKind(body.kind);
    const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : "";
    const byteSize = typeof body.byteSize === "number" ? body.byteSize : null;
    if (!kind || !mimeType) return NextResponse.json({ error: "INVALID_DERIVATIVE_REQUEST" }, { status: 400 });
    if (byteSize != null && (!Number.isSafeInteger(byteSize) || byteSize < 0)) return NextResponse.json({ error: "INVALID_BYTE_SIZE" }, { status: 400 });

    const storageKey = `users/${user.id}/derivatives/${assetId}/${randomUUID()}-${kind.toLowerCase()}`;
    const derivative = await createDerivative(user.id, assetId, {
      kind,
      storageKey,
      mimeType,
      metadata: { uploadState: "PENDING" },
    });

    try {
      const upload = await getAssetStorageAdapter().createUploadUrl({
        assetId: derivative.id,
        storageKey: derivative.storageKey,
        contentType: mimeType,
        byteSize: byteSize ?? undefined,
      });
      return NextResponse.json({ data: { derivative, ...upload } }, { status: 201 });
    } catch (error) {
      console.error("DERIVATIVE_UPLOAD_URL_CREATE_FAILED", error);
      return NextResponse.json({ error: "DERIVATIVE_UPLOAD_PREPARATION_FAILED", derivativeId: derivative.id }, { status: 503 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : message.startsWith("INVALID_") ? 400 : message === "ASSET_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
