import { NextResponse } from "next/server";
import { requireAppUser } from "@/src/lib/auth/current-app-user";
import { listAssetDerivatives } from "@/src/lib/assets/derivatives";

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const user = await requireAppUser();
    const { assetId } = await context.params;
    const data = await listAssetDerivatives(user.id, assetId);
    if (!data) return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}
