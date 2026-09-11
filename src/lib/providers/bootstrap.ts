import { configureCredentialResolver, getProviderAdapter, registerProviderAdapter } from "./registry";
import { googleVeoAdapter } from "./google-veo";

let bootstrapped = false;

export function ensureProviderAdapters() {
  if (bootstrapped) return;
  configureCredentialResolver(async (credentialRef) => {
    const normalized = credentialRef.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    const value = process.env[`CADDYSOFT_CREDENTIAL_${normalized}`];
    if (!value) throw new Error("CREDENTIAL_NOT_CONFIGURED");
    return { GEMINI_API_KEY: value };
  });
  if (!getProviderAdapter("GOOGLE_VEO")) registerProviderAdapter("GOOGLE_VEO", googleVeoAdapter);
  bootstrapped = true;
}
