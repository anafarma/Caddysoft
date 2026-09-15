import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const clerkPublishableKeyConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const clerkSecretKeyConfigured = Boolean(process.env.CLERK_SECRET_KEY);
  const databaseConfigured = Boolean(process.env.DATABASE_URL);

  const ready = clerkPublishableKeyConfigured && clerkSecretKeyConfigured && databaseConfigured;

  return NextResponse.json(
    {
      ok: ready,
      service: "caddysoft",
      checks: {
        clerkPublishableKey: clerkPublishableKeyConfigured,
        clerkSecretKey: clerkSecretKeyConfigured,
        database: databaseConfigured,
      },
    },
    { status: ready ? 200 : 503 },
  );
}
