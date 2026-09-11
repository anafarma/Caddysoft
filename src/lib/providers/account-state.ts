import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/src/lib/db";
import { providerAccounts } from "@/src/lib/db/schema";

export async function markAccountUsed(accountId: string) {
  const rows = await getDb().update(providerAccounts).set({
    status: "BUSY",
    usedToday: sql`${providerAccounts.usedToday} + 1`,
    lastUsedAt: new Date(),
    firstGenerationAt: sql`COALESCE(${providerAccounts.firstGenerationAt}, now())`,
    updatedAt: new Date(),
  }).where(and(
    eq(providerAccounts.id, accountId),
    eq(providerAccounts.status, "READY"),
  )).returning();
  return rows[0] ?? null;
}

export async function markAccountReady(accountId: string, remainingToday?: number | null) {
  await getDb().update(providerAccounts).set({
    status: "READY", remainingToday: remainingToday ?? null, cooldownUntil: null,
    lastErrorCode: null, lastErrorMessage: null, updatedAt: new Date(),
  }).where(eq(providerAccounts.id, accountId));
}

export async function markAccountCooldown(accountId: string, errorCode: string, message: string, cooldownMs = 60_000) {
  await getDb().update(providerAccounts).set({
    status: "COOLDOWN", cooldownUntil: new Date(Date.now() + Math.max(1000, cooldownMs)),
    lastErrorCode: errorCode.slice(0, 100), lastErrorMessage: message.slice(0, 1000), updatedAt: new Date(),
  }).where(eq(providerAccounts.id, accountId));
}

export async function markAccountExhausted(accountId: string, resetAt?: Date | null) {
  await getDb().update(providerAccounts).set({
    status: "EXHAUSTED", remainingToday: 0, nextRefreshAt: resetAt ?? null, updatedAt: new Date(),
  }).where(eq(providerAccounts.id, accountId));
}
