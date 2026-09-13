import { NextResponse } from "next/server";
import { requireAppUser } from "@/src/lib/auth/current-app-user";
import { buildProjectGenerationPlan, createScene, listProjectScenes } from "@/src/lib/scenes/pipeline";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
  const status = message === "UNAUTHENTICATED" ? 401
    : ["PROJECT_NOT_FOUND", "SCENE_NOT_FOUND"].includes(message) ? 404
    : ["SCENE_CONFLICT"].includes(message) ? 409
    : message.startsWith("INVALID_") || message.startsWith("SCENE_") ? 400
    : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireAppUser();
    const { projectId } = await context.params;
    return NextResponse.json({ data: await listProjectScenes(user.id, projectId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireAppUser();
    const { projectId } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    const record = await createScene(user.id, projectId, {
      title: typeof body.title === "string" ? body.title : "",
      position: typeof body.position === "number" ? body.position : undefined,
      prompt: typeof body.prompt === "string" ? body.prompt : null,
      structuredPrompt: body.structuredPrompt && typeof body.structuredPrompt === "object" && !Array.isArray(body.structuredPrompt) ? body.structuredPrompt : null,
      durationSeconds: typeof body.durationSeconds === "number" ? body.durationSeconds : null,
      settings: body.settings && typeof body.settings === "object" && !Array.isArray(body.settings) ? body.settings : {},
    });
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await requireAppUser();
    const { projectId } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    const plan = await buildProjectGenerationPlan(user.id, projectId);
    return NextResponse.json({ data: plan });
  } catch (error) {
    return errorResponse(error);
  }
}
