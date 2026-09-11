import { NextResponse } from "next/server";
import { requireAppUser } from "@/src/lib/auth/current-app-user";
import { createProject, listProjects } from "@/src/lib/db/repositories";

export async function GET() {
  try {
    const user = await requireAppUser();
    const projects = await listProjects(user.id);
    return NextResponse.json({ data: projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    }

    const record = await createProject(user.id, {
      name: typeof body.name === "string" ? body.name : "",
      description: typeof body.description === "string" ? body.description : null,
    });
    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "UNAUTHENTICATED" ? 401 : message.startsWith("INVALID_") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
