import { NextResponse } from "next/server";
import { claimNextJob, failJob, succeedJob } from "@/src/lib/jobs/repository";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return new NextResponse("Unauthorized", { status: 401 });

  const job = await claimNextJob();
  if (!job) return NextResponse.json({ ok: true, processed: false });

  try {
    // M5 provider/derivative handlers attach here. Keeping the worker boundary
    // separate prevents provider calls from leaking into authenticated web routes.
    switch (job.type) {
      case "GENERATION":
        throw new Error("GENERATION_WORKER_NOT_CONFIGURED");
      case "DERIVATIVE":
        throw new Error("DERIVATIVE_WORKER_NOT_CONFIGURED");
      default:
        throw new Error("UNKNOWN_JOB_TYPE");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const retryable = message !== "UNKNOWN_JOB_TYPE";
    const attempt = Number(job.attempt ?? 1);
    const maxAttempts = Number(job.maxAttempts ?? 3);
    await failJob(job.id as string, message, message, retryable && attempt < maxAttempts);
    return NextResponse.json({ ok: false, processed: true, jobId: job.id, error: message }, { status: 500 });
  }
}
