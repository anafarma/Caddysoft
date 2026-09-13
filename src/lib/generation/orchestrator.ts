import { and, eq } from "drizzle-orm";
import { getDb } from "@/src/lib/db";
import { generations, providerAccounts, providers, usageEvents } from "@/src/lib/db/schema";
import { createAsset, markAssetDeleted } from "@/src/lib/db/repositories";
import { getGeneration, markGenerationStarted, setProviderOperation, completeGeneration, failGeneration, createGenerationVersion, listGenerationVersions } from "./repository";
import { selectProviderAccount } from "@/src/lib/providers/account-selector";
import { getProviderAdapter } from "@/src/lib/providers/registry";
import { ensureProviderAdapters } from "@/src/lib/providers/bootstrap";
import { classifyProviderError } from "@/src/lib/providers/errors";
import { releaseAccountClaim, markAccountReady, markAccountCooldown, markAccountExhausted } from "@/src/lib/providers/account-state";
import { getAssetStorageAdapter } from "@/src/lib/assets/storage";
import type { ProviderSubmission } from "@/src/lib/providers/types";

async function persistProviderOutput(userId: string, generation: Awaited<ReturnType<typeof getGeneration>>, result: ProviderSubmission) {
  if (!generation || !result.output) throw new Error("PROVIDER_OUTPUT_MISSING");

  const storageKey = `users/${userId}/projects/${generation.projectId}/generations/${generation.id}/output.mp4`;
  const storage = getAssetStorageAdapter();
  let assetId: string | null = null;

  try {
    const uploaded = await storage.uploadStream({
      storageKey,
      body: result.output.body,
      contentType: result.output.mimeType,
    });

    const asset = await createAsset(userId, {
      projectId: generation.projectId,
      kind: "VIDEO",
      name: result.output.filename || `${generation.id}.mp4`,
      storageKey,
      mimeType: result.output.mimeType,
      byteSize: uploaded.byteSize ?? result.output.byteSize ?? null,
      metadata: {
        generationId: generation.id,
        providerId: generation.providerId,
        providerOperationId: generation.providerOperationId,
        ...(result.output.metadata ?? {}),
        uploadState: "COMPLETE",
      },
    });
    assetId = asset.id;

    const version = await createGenerationVersion(
      generation.id,
      { model: generation.model, prompt: generation.promptSnapshot, config: generation.requestConfig },
      result.raw,
      asset.id,
    );
    if (!version) throw new Error("GENERATION_VERSION_CREATE_FAILED");

    return asset;
  } catch (error) {
    if (assetId) await markAssetDeleted(assetId).catch(() => undefined);
    await storage.deleteObject({ storageKey }).catch(() => undefined);
    throw error;
  }
}

async function recordUsageOnce(generation: Awaited<ReturnType<typeof getGeneration>>) {
  if (!generation) return;

  await getDb().insert(usageEvents).values({
    userId: generation.userId,
    providerAccountId: generation.providerAccountId,
    generationId: generation.id,
    model: generation.model,
    units: 1,
    cost: generation.actualCost ?? generation.estimatedCost ?? null,
    status: "COMPLETED",
    metadata: { providerId: generation.providerId },
  }).onConflictDoNothing({ target: usageEvents.generationId });
}

async function finishCompletedGeneration(userId: string, generationId: string, result: ProviderSubmission) {
  const generation = await getGeneration(userId, generationId);
  if (!generation) throw new Error("GENERATION_NOT_FOUND");

  const versions = await listGenerationVersions(generationId);
  const existingOutput = versions.find((version) => Boolean(version.outputAssetId));
  if (!existingOutput) await persistProviderOutput(userId, generation, result);

  const completed = generation.status === "COMPLETED"
    ? generation
    : await completeGeneration(userId, generationId);
  await recordUsageOnce(completed);
  return completed;
}

export async function executeGeneration(userId: string, generationId: string) {
  ensureProviderAdapters();
  const generation = await getGeneration(userId, generationId);
  if (!generation) throw new Error("GENERATION_NOT_FOUND");
  const provider = (await getDb().select().from(providers).where(and(eq(providers.id, generation.providerId), eq(providers.enabled, true))).limit(1))[0];
  if (!provider) throw new Error("PROVIDER_NOT_AVAILABLE");
  const account = await selectProviderAccount(userId, provider.id);
  if (!account) throw new Error("NO_PROVIDER_ACCOUNT_AVAILABLE");
  const adapter = getProviderAdapter(provider.type);
  if (!adapter) {
    await releaseAccountClaim(account.id);
    throw new Error("PROVIDER_ADAPTER_NOT_CONFIGURED");
  }
  const started = await markGenerationStarted(userId, generationId, account.id);
  if (!started) {
    await releaseAccountClaim(account.id);
    return getGeneration(userId, generationId);
  }
  try {
    const result = await adapter.submit({ generationId, model: generation.model, prompt: generation.promptSnapshot, config: generation.requestConfig }, account);
    await setProviderOperation(userId, generationId, result.operationId);
    if (result.status === "COMPLETED") {
      await finishCompletedGeneration(userId, generationId, result);
      await markAccountReady(account.id);
    }
    return getGeneration(userId, generationId);
  } catch (error) {
    const failure = classifyProviderError(error);
    if (failure.class === "EXHAUSTED") await markAccountExhausted(account.id);
    else if (failure.class === "COOLDOWN" || failure.class === "RETRYABLE") await markAccountCooldown(account.id, failure.code, failure.message);
    else if (failure.class === "AUTH") await markAccountCooldown(account.id, failure.code, failure.message, 15 * 60_000);
    else await markAccountReady(account.id);
    await failGeneration(userId, generationId, failure.code, failure.message);
    throw error;
  }
}

export async function pollGeneration(userId: string, generationId: string): Promise<ProviderSubmission> {
  ensureProviderAdapters();
  const generation = await getGeneration(userId, generationId);
  if (!generation?.providerOperationId) throw new Error("PROVIDER_OPERATION_NOT_FOUND");
  if (generation.status === "COMPLETED") {
    await recordUsageOnce(generation);
    return { operationId: generation.providerOperationId, status: "COMPLETED" };
  }

  const provider = (await getDb().select().from(providers).where(and(eq(providers.id, generation.providerId), eq(providers.enabled, true))).limit(1))[0];
  if (!provider || !generation.providerAccountId) throw new Error("PROVIDER_CONTEXT_NOT_FOUND");
  const adapter = getProviderAdapter(provider.type);
  if (!adapter) throw new Error("PROVIDER_ADAPTER_NOT_CONFIGURED");
  const account = (await getDb().select().from(providerAccounts).where(eq(providerAccounts.id, generation.providerAccountId)).limit(1))[0];
  if (!account) throw new Error("PROVIDER_ACCOUNT_NOT_FOUND");
  const result = await adapter.poll(generation.providerOperationId, {
    id: account.id, providerId: account.providerId, status: account.status, remainingToday: account.remainingToday,
    cooldownUntil: account.cooldownUntil, lastUsedAt: account.lastUsedAt, credentialRef: account.credentialRef, metadata: account.metadata,
  });
  if (result.status === "COMPLETED") {
    await finishCompletedGeneration(userId, generationId, result);
    await markAccountReady(account.id);
  } else if (result.status === "FAILED") {
    await markAccountCooldown(account.id, "PROVIDER_OPERATION_FAILED", "Provider operation failed");
    await failGeneration(userId, generationId, "PROVIDER_OPERATION_FAILED", "Provider operation failed");
  }
  return result;
}
