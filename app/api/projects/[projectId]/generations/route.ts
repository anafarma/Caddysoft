import { NextResponse } from "next/server";
import { requireAppUser } from "@/src/lib/auth/current-app-user";
import { buildSceneGenerationSnapshot } from "@/src/lib/scenes/pipeline";
import { createQueuedGeneration } from "@/src/lib/generation/repository";
import { enqueueJob } from "@/src/lib/jobs/repository";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const status = message === "UNAUTHENTICATED" ? 401
    : ["PROJECT_NOT_FOUND", "PROVIDER_NOT_AVAILABLE", "SCENE_NOT_FOUND"].includes(message) ? 404
    : message.startsWith("SCENE_") || message.startsWith("INVALID_") ? 400
    : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireAppUser();
    const { projectId } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });

    const sceneId = typeof body.sceneId === "string" ? body.sceneId : "";
    const providerId = typeof body.providerId === "string" ? body.providerId : "";
    const model = typeof body.model === "string" ? body.model.trim() : "";
    if (!sceneId || !providerId || !model || model.length > 200) return NextResponse.json({ error: "INVALID_GENERATION_INPUT" }, { status: 400 });

    const references = {
      characterIds: Array.isArray(body.characterIds) ? body.characterIds.filter((id: unknown): id is string => typeof id === "string") : [],
      locationIds: Array.isArray(body.locationIds) ? body.locationIds.filter((id: unknown): id is string => typeof id === "string") : [],
      styleIds: Array.isArray(body.styleIds) ? body.styleIds.filter((id: unknown): id is string => typeof id === "string") : [],
    };
    const snapshot = await buildSceneGenerationSnapshot(user.id, projectId, sceneId, references);
    const generation = await createQueuedGeneration(user.id, {
      projectId,
      sceneId,
      providerId,
      model,
      promptSnapshot: snapshot.prompt,
      requestConfig: {
        durationSeconds: snapshot.durationSeconds,
        settings: snapshot.settings,
        structuredPrompt: snapshot.structuredPrompt,
        references: snapshot.references,
      },
    });

    const job = await enqueueJob(user.id, {
      type: "GENERATION",
      idempotencyKey: "generation:" + generation.id,
      payload: { generationId: generation.id, providerId },
      projectId,
      generationId: generation.id,
      maxAttempts: 3,
    });

    return NextResponse.json({ data: { generation, job } }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
