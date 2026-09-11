import { NextResponse } from "next/server";
import { requireAppUser } from "@/src/lib/auth/current-app-user";
import { createAsset, listAssets } from "@/src/lib/db/repositories";

const ASSET_KINDS = ["IMAGE", "VIDEO", "AUDIO", "CHARACTER", "LOCATION", "LOGO", "REFERENCE", "OTHER"] as const;

function isAssetKind(value: unknown): value is (typeof ASSET_KINDS)[number] {
  return typeof value === "string" && (ASSET_KINDS as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  try {
    const user = await requireAppUser();
    const url = new URL(request.url);
    const projectId = url.searchParams.get("projectId");
    const kind = url.searchParams.get("kind");
    if (kind && !isAssetKind(kind)) return NextResponse.json({ error: "INVALID_ASSET_KIND" }, { status: 400 });

    const data = await listAssets(user.id, { projectId, kind: kind as (typeof ASSET_KINDS)[number] | null });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });

    const record = await createAsset(user.id, {
      projectId: typeof body.projectId === "string" ? body.projectId : null,
      kind: isAssetKind(body.kind) ? body.kind : undefined,
      name: typeof body.name === "string" ? body.name : "",
      storageKey: typeof body.storageKey === "string" ? body.storageKey : "",
      mimeType: typeof body.mimeType === "string" ? body.mimeType : null,
      byteSize: typeof body.byteSize === "number" ? body.byteSize : null,
      durationMs: typeof body.durationMs === "number" ? body.durationMs : null,
      width: typeof body.width === "number" ? body.width : null,
      height: typeof body.height === "number" ? body.height : null,
      metadata: body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {},
    });
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : message.startsWith("INVALID_") ? 400 : message === "PROJECT_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
