import { and, eq } from "drizzle-orm";
import { getDb } from "@/src/lib/db";
import { providerAccounts, providers } from "@/src/lib/db/schema";
import { getGeneration, markGenerationStarted, setProviderOperation, completeGeneration, failGeneration } from "./repository";
import { selectProviderAccount } from "@/src/lib/providers/account-selector";
import { getProviderAdapter } from "@/src/lib/providers/registry";
import { classifyProviderError } from "@/src/lib/providers/errors";
import { markAccountReady, markAccountCooldown, markAccountExhausted } from "@/src/lib/providers/account-state";
import type { ProviderSubmission } from "@/src/lib/providers/types";

export async function executeGeneration(userId: string, generationId: string) {
  const generation = await getGeneration(userId, generationId);
  if (!generation) throw new Error("GENERATION_NOT_FOUND");
  const provider = (await getDb().select().from(providers).where(and(eq(providers.id, generation.providerId), eq(providers.enabled, true))).limit(1))[0];
  if (!provider) throw new Error("PROVIDER_NOT_AVAILABLE");
  const account = await selectProviderAccount(userId, provider.id);
  if (!account) throw new Error("NO_PROVIDER_ACCOUNT_AVAILABLE");
  const adapter = getProviderAdapter(provider.type);
  if (!adapter) {
    await markAccountReady(account.id, account.remainingToday);
    throw new Error("PROVIDER_ADAPTER_NOT_CONFIGURED");
  }
  const started = await markGenerationStarted(userId, generationId, account.id);
  if (!started) {
    await markAccountReady(account.id, account.remainingToday);
    return getGeneration(userId, generationId);
  }
  try {
    const result = await adapter.submit({ generationId, model: generation.model, prompt: generation.promptSnapshot, config: generation.requestConfig }, account);
    await setProviderOperation(userId, generationId, result.operationId);
    if (result.status === "COMPLETED") {
      await completeGeneration(userId, generationId);
      await markAccountReady(account.id, account.remainingToday);
    }
    return getGeneration(userId, generationId);
  } catch (error) {
    const failure = classifyProviderError(error);
    if (failure.class === "EXHAUSTED") await markAccountExhausted(account.id);
    else if (failure.class === "COOLDOWN" || failure.class === "RETRYABLE") await markAccountCooldown(account.id, failure.code, failure.message);
    else if (failure.class === "AUTH") await markAccountCooldown(account.id, failure.code, failure.message, 15 * 60_000);
    else await markAccountReady(account.id, account.remainingToday);
    await failGeneration(userId, generationId, failure.code, failure.message);
    throw error;
  }
}

export async function pollGeneration(userId: string, generationId: string): Promise<ProviderSubmission> {
  const generation = await getGeneration(userId, generationId);
  if (!generation?.providerOperationId) throw new Error("PROVIDER_OPERATION_NOT_FOUND");
  const provider = (await getDb().select().from(providers).where(and(eq(providers.id, generation.providerId), eq(providers.enabled, true))).limit(1))[0];
  if (!provider || !generation.providerAccountId) throw new Error("PROVIDER_CONTEXT_NOT_FOUND");
  const adapter = getProviderAdapter(provider.type);
  if (!adapter) throw new Error("PROVIDER_ADAPTER_NOT_CONFIGURED");
  const account = (await getDb().select().from(providerAccounts).where(eq(providerAccounts.id, generation.providerAccountId)).limit(1))[0];
  if (!account) throw new Error("PROVIDER_ACCOUNT_NOT_FOUND");
  const result = await adapter.poll(generation.providerOperationId, {
    id: account.id, providerId: account.providerId, status: account.status, remainingToday: account.remainingToday,
    cooldownUntil: account.cooldownUntil, lastUsedAt: account.lastUsedAt, metadata: account.metadata,
  });
  if (result.status === "COMPLETED") {
    await completeGeneration(userId, generationId);
    await markAccountReady(account.id, account.remainingToday);
  } else if (result.status === "FAILED") {
    await markAccountCooldown(account.id, "PROVIDER_OPERATION_FAILED", "Provider operation failed");
    await failGeneration(userId, generationId, "PROVIDER_OPERATION_FAILED", "Provider operation failed");
  }
  return result;
}
