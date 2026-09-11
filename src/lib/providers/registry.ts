import type { ProviderAdapter } from "./types";

const adapters = new Map<string, ProviderAdapter>();

export function registerProviderAdapter(providerType: string, adapter: ProviderAdapter) {
  adapters.set(providerType, adapter);
}

export function getProviderAdapter(providerType: string) {
  return adapters.get(providerType) ?? null;
}

export type CredentialResolver = (credentialRef: string) => Promise<Record<string, string>>;

let credentialResolver: CredentialResolver | null = null;

export function configureCredentialResolver(resolver: CredentialResolver) {
  credentialResolver = resolver;
}

export async function resolveProviderCredential(credentialRef: string) {
  if (!credentialResolver) throw new Error("CREDENTIAL_RESOLVER_NOT_CONFIGURED");
  if (!credentialRef || credentialRef.length > 500) throw new Error("INVALID_CREDENTIAL_REF");
  return credentialResolver(credentialRef);
}
