import { and, eq, inArray, or, isNull, lte, asc } from "drizzle-orm";
import { getDb } from "@/src/lib/db";
import { providerAccounts } from "@/src/lib/db/schema";
import type { ProviderAccountCandidate } from "./types";

export async function selectProviderAccount(userId: string, providerId: string): Promise<ProviderAccountCandidate | null> {
  const now = new Date();
  const rows = await getDb().select().from(providerAccounts).where(and(
    eq(providerAccounts.userId, userId),
    eq(providerAccounts.providerId, providerId),
    inArray(providerAccounts.status, ["READY", "COOLDOWN"]),
    or(isNull(providerAccounts.cooldownUntil), lte(providerAccounts.cooldownUntil, now)),
  )).orderBy(
    asc(providerAccounts.usedToday),
    asc(providerAccounts.lastUsedAt),
    asc(providerAccounts.createdAt),
  );
  const candidate = rows.find(row => row.status === "READY" || (row.cooldownUntil && row.cooldownUntil <= now));
  return candidate ? {
    id: candidate.id, providerId: candidate.providerId, status: candidate.status,
    remainingToday: candidate.remainingToday, cooldownUntil: candidate.cooldownUntil,
    lastUsedAt: candidate.lastUsedAt, metadata: candidate.metadata,
  } : null;
}