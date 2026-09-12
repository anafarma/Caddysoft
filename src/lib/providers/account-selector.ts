import { and, asc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { getDb } from "@/src/lib/db";
import { providerAccounts } from "@/src/lib/db/schema";
import type { ProviderAccountCandidate } from "./types";

export async function selectProviderAccount(userId: string, providerId: string): Promise<ProviderAccountCandidate | null> {
  const now = new Date();
  const rows = await getDb().select().from(providerAccounts).where(and(
    eq(providerAccounts.userId, userId), eq(providerAccounts.providerId, providerId), eq(providerAccounts.status, "READY"),
    or(isNull(providerAccounts.remainingToday), gt(providerAccounts.remainingToday, 0)),
    or(isNull(providerAccounts.cooldownUntil), lt(providerAccounts.cooldownUntil, now)),
  )).orderBy(asc(providerAccounts.usedToday), asc(providerAccounts.lastUsedAt), asc(providerAccounts.createdAt));
  for (const candidate of rows) {
    const claimed = await getDb().update(providerAccounts).set({
      status: "BUSY", usedToday: candidate.usedToday + 1, lastUsedAt: now,
      firstGenerationAt: candidate.firstGenerationAt ?? now, updatedAt: now,
    }).where(and(eq(providerAccounts.id, candidate.id), eq(providerAccounts.status, "READY"))).returning();
    if (claimed[0]) return {
      id: candidate.id, providerId: candidate.providerId, status: "BUSY",
      remainingToday: candidate.remainingToday == null ? null : Math.max(0, candidate.remainingToday - 1),
      cooldownUntil: null, lastUsedAt: now, credentialRef: candidate.credentialRef, metadata: candidate.metadata,
    };
  }
  return null;
}
