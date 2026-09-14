import { NextResponse } from "next/server";
import { requireAppUser } from "@/src/lib/auth/current-app-user";
import { getGeneration } from "@/src/lib/generation/repository";

export async function GET(_request: Request, context: { params: Promise<{ generationId: string }> }) {
  try {
    const user = await requireAppUser();
    const { generationId } = await context.params;
    const generation = await getGeneration(user.id, generationId);
    if (!generation) return NextResponse.json({ error: "GENERATION_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ data: generation });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}
