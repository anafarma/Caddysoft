export type ProviderFailureClass = "RETRYABLE" | "COOLDOWN" | "EXHAUSTED" | "AUTH" | "INVALID_REQUEST" | "FATAL";

export function classifyProviderError(error: unknown): { class: ProviderFailureClass; code: string; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (/quota|rate.?limit|429|resource.?exhaust/.test(normalized)) return { class: "EXHAUSTED", code: "PROVIDER_QUOTA", message };
  if (/timeout|temporar|network|502|503|504/.test(normalized)) return { class: "RETRYABLE", code: "PROVIDER_TRANSIENT", message };
  if (/unauthor|forbidden|invalid.?credential|401|403/.test(normalized)) return { class: "AUTH", code: "PROVIDER_AUTH", message };
  if (/invalid.?request|bad.?request|400/.test(normalized)) return { class: "INVALID_REQUEST", code: "PROVIDER_INVALID_REQUEST", message };
  return { class: "FATAL", code: "PROVIDER_FATAL", message };
}
