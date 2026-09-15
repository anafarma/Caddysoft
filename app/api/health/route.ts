import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export async function GET() {
  const checks = {
    clerkPublishableKey: Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY),
    clerkSecretKey: Boolean(process.env.CLERK_SECRET_KEY),
    database: Boolean(process.env.DATABASE_URL),
  };

  const ready = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      ok: ready,
      service: "caddysoft",
      checks,
      timestamp: new Date().toISOString(),
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
