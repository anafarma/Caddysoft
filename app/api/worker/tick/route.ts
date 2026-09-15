import { NextResponse } from "next/server";
import { requireAppUser } from "@/src/lib/auth/current-app-user";
import { processOneJob } from "@/src/lib/jobs/worker";

export async function POST() {
  try {
    await requireAppUser();
    const result = await processOneJob();
    return NextResponse.json({ ok: !result.error, ...result }, { status: result.error ? 500 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHENTICATED") {
      return NextResponse.json({ ok: false, error: message }, { status: 401 });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
