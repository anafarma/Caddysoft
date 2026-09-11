import { getProviderAdapter, registerProviderAdapter } from "./registry";
import { googleVeoAdapter } from "./google-veo";

let bootstrapped = false;

export function ensureProviderAdapters() {
  if (bootstrapped) return;
  if (!getProviderAdapter("GOOGLE_VEO")) registerProviderAdapter("GOOGLE_VEO", googleVeoAdapter);
  bootstrapped = true;
}
