import { getDb } from "@/src/lib/db";
import { providers, providerAccounts } from "@/src/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { getGeneration, markGenerationStarted, setProviderOperation, completeGeneration, failGeneration } from "./repository";
import { selectProviderAccount } from "@/src/lib/providers/account-selector";
import { getProviderAdapter } from "@/src/lib/providers/registry";
import { classifyProviderError } from "@/src/lib/providers/errors";
import { markAccountReady, markAccountCooldown, markAccountExhausted } from "@/src/lib/providers/account-state";

export async function executeGeneration(userId: string, generationId: string) {
  const generation = await getGeneration(userId, generationId);
  if (!generation) throw new Error("GENERATION_NOT_FOUND");

  const provider = (await getDb().select().from(providers).where(and(eq(providers.id, generation.providerId), eq(providers.enabled, true))).limit(1))[0];
  if (!provider) throw new Error("PROVIDER_NOT_AVAILABLE");

  const account = await selectProviderAccount(userId, provider.id);
  if (!account) throw new Error("NO_PROVIDER_ACCOUNT_AVAILABLE");

  const adapter = getProviderAdapter(provider.type);
  if (!adapter) throw new Error("PROVIDER_ADAPTER_NOT_CONFIGURED");

  const started = await markGenerationStarted(userId, generationId, account.id);
  if (!started) return getGeneration(userId, generationId);

  try {
    const result = await adapter.submit({
      generationId,
      model: generation.model,
      prompt: generation.promptSnapshot,
      config: generation.requestConfig,
    }, account);
    await setProviderOperation(userId, generationId, result.operationId);
    await markAccountReady(account.id);
    return getGeneration(userId, generationId);
  } catch (error) {
    const failure = classifyProviderError(error);
    if (failure.class === "EXHAUSTED") await markAccountExhausted(account.id);
    else if (failure.class === "COOLDOWN" || failure.class === "RETRYABLE") await markAccountCooldown(account.id, failure.code, failure.message);
    else if (failure.class === "AUTH") await markAccountCooldown(account.id, failure.code, failure.message, 15 * 60_000);
    await failGeneration(userId, generationId, failure.code, failure.message);
    throw error;
  }
}
