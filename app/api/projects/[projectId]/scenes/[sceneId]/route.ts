import { NextResponse } from "next/server";
import { requireAppUser } from "@/src/lib/auth/current-app-user";
import { archiveScene, updateScene } from "@/src/lib/scenes/pipeline";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const status = message === "UNAUTHENTICATED" ? 401
    : ["PROJECT_NOT_FOUND", "SCENE_NOT_FOUND"].includes(message) ? 404
    : message === "SCENE_CONFLICT" ? 409
    : message.startsWith("INVALID_") || message.startsWith("SCENE_") ? 400
    : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string; sceneId: string }> }) {
  try {
    const user = await requireAppUser();
    const { projectId, sceneId } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    const record = await updateScene(user.id, projectId, sceneId, {
      title: typeof body.title === "string" ? body.title : undefined,
      position: typeof body.position === "number" ? body.position : undefined,
      prompt: typeof body.prompt === "string" || body.prompt === null ? body.prompt : undefined,
      structuredPrompt: body.structuredPrompt === null || (body.structuredPrompt && typeof body.structuredPrompt === "object" && !Array.isArray(body.structuredPrompt)) ? body.structuredPrompt : undefined,
      durationSeconds: typeof body.durationSeconds === "number" || body.durationSeconds === null ? body.durationSeconds : undefined,
      settings: body.settings && typeof body.settings === "object" && !Array.isArray(body.settings) ? body.settings : undefined,
    }, typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : undefined);
    return NextResponse.json({ data: record });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ projectId: string; sceneId: string }> }) {
  try {
    const user = await requireAppUser();
    const { projectId, sceneId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const record = await archiveScene(user.id, projectId, sceneId, typeof body.expectedUpdatedAt === "string" ? body.expectedUpdatedAt : undefined);
    return NextResponse.json({ data: record });
  } catch (error) {
    return errorResponse(error);
  }
}
