import { eq } from "drizzle-orm";
import { currentUser } from "@clerk/nextjs/server";
import { getDb } from "../db";
import { users } from "../db/schema";

export async function requireAppUser() {
  const identity = await currentUser();
  if (!identity) throw new Error("UNAUTHENTICATED");

  const authSubject = identity.id;
  const email = identity.emailAddresses[0]?.emailAddress ?? null;
  const name = [identity.firstName, identity.lastName].filter(Boolean).join(" ") || null;

  const db = getDb();
  const rows = await db
    .insert(users)
    .values({ authSubject, email, name })
    .onConflictDoUpdate({
      target: users.authSubject,
      set: { email, name, updatedAt: new Date() },
    })
    .returning();

  if (!rows[0]) throw new Error("USER_SYNC_FAILED");
  return rows[0];
}
