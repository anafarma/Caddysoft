import { NextResponse } from "next/server";
import { processOneJob } from "@/src/lib/jobs/worker";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return new NextResponse("Unauthorized", { status: 401 });
  const result = await processOneJob();
  return NextResponse.json({ ok: !result.error, ...result }, { status: result.error ? 500 : 200 });
}
