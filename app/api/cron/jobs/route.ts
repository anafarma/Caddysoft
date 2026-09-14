import { NextResponse } from "next/server";
import { executeGeneration, pollGeneration } from "@/src/lib/generation/orchestrator";
import { claimNextJob, enqueueJob, failJob, succeedJob } from "@/src/lib/jobs/repository";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return new NextResponse("Unauthorized", { status: 401 });
  const job = await claimNextJob();
  if (!job) return NextResponse.json({ ok: true, processed: false });

  try {
    const payload = job.payload as Record<string, unknown>;
    const generationId = typeof payload.generationId === "string" ? payload.generationId : null;
    if (!generationId) throw new Error("GENERATION_ID_MISSING");

    if (job.type === "GENERATION") {
      const generation = await executeGeneration(job.userId as string, generationId);
      if (generation?.status === "GENERATING") {
        await enqueueJob(job.userId as string, {
          type: "GENERATION_POLL",
          idempotencyKey: `${generationId}:poll:${Math.floor(Date.now() / 300000) + 1}`,
          payload: { generationId },
          projectId: job.projectId as string | null,
          generationId,
          providerAccountId: generation.providerAccountId,
          maxAttempts: 48,
        });
      }
    } else if (job.type === "GENERATION_POLL") {
      const result = await pollGeneration(job.userId as string, generationId);
      if (result.status === "RUNNING") {
        await enqueueJob(job.userId as string, {
          type: "GENERATION_POLL",
          idempotencyKey: `${generationId}:poll:${Math.floor(Date.now() / 300000) + 1}`,
          payload: { generationId },
          projectId: job.projectId as string | null,
          generationId,
          providerAccountId: job.providerAccountId as string | null,
          maxAttempts: 48,
        });
      }
    } else if (job.type === "DERIVATIVE") {
      throw new Error("DERIVATIVE_WORKER_NOT_CONFIGURED");
    } else {
      throw new Error("UNKNOWN_JOB_TYPE");
    }

    await succeedJob(job.id as string);
    return NextResponse.json({ ok: true, processed: true, jobId: job.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const retryable = !["UNKNOWN_JOB_TYPE", "GENERATION_ID_MISSING"].includes(message);
    const attempt = Number(job.attempt ?? 1);
    const maxAttempts = Number(job.maxAttempts ?? 3);
    await failJob(job.id as string, message, message, retryable && attempt < maxAttempts);
    return NextResponse.json({ ok: false, processed: true, jobId: job.id, error: message }, { status: 500 });
  }
}
