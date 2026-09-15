import { NextResponse } from "next/server";
import { requireAppUser } from "@/src/lib/auth/current-app-user";
import { buildProjectGenerationPlan } from "@/src/lib/scenes/pipeline";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireAppUser();
    const { projectId } = await context.params;
    const plan = await buildProjectGenerationPlan(user.id, projectId);
    return NextResponse.json({ data: { projectId, sceneCount: plan.length, scenes: plan } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : message === "PROJECT_NOT_FOUND" ? 404 : message.startsWith("SCENE_") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
