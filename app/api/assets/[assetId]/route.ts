import { NextResponse } from "next/server";
import { requireAppUser } from "@/src/lib/auth/current-app-user";
import { getDb } from "@/src/lib/db";
import { assets } from "@/src/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const user = await requireAppUser();
    const { assetId } = await context.params;
    const rows = await getDb().select().from(assets).where(and(eq(assets.id, assetId), eq(assets.userId, user.id), isNull(assets.deletedAt))).limit(1);
    if (!rows[0]) return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ data: rows[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  try {
    const user = await requireAppUser();
    const { assetId } = await context.params;
    const rows = await getDb().update(assets).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(assets.id, assetId), eq(assets.userId, user.id), isNull(assets.deletedAt))).returning({ id: assets.id });
    if (!rows[0]) return NextResponse.json({ error: "ASSET_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ data: { id: rows[0].id, deleted: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}
