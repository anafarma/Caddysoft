import { NextResponse } from "next/server";
import { requireAppUser } from "@/src/lib/auth/current-app-user";
import { enqueueJob } from "@/src/lib/jobs/repository";
import { JOB_TYPES } from "@/src/lib/jobs/types";

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    if (body.type !== JOB_TYPES.GENERATION && body.type !== JOB_TYPES.DERIVATIVE) return NextResponse.json({ error: "INVALID_JOB_TYPE" }, { status: 400 });
    if (typeof body.idempotencyKey !== "string" || body.idempotencyKey.length < 8) return NextResponse.json({ error: "INVALID_IDEMPOTENCY_KEY" }, { status: 400 });
    if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) return NextResponse.json({ error: "INVALID_PAYLOAD" }, { status: 400 });

    const job = await enqueueJob(user.id, {
      type: body.type,
      idempotencyKey: body.idempotencyKey,
      payload: body.payload,
      projectId: typeof body.projectId === "string" ? body.projectId : null,
      generationId: typeof body.generationId === "string" ? body.generationId : null,
      providerAccountId: typeof body.providerAccountId === "string" ? body.providerAccountId : null,
    });
    return NextResponse.json({ data: job }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: message === "UNAUTHENTICATED" ? 401 : 500 });
  }
}
