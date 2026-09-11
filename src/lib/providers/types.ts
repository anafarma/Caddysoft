export type ProviderAccountCandidate = {
  id: string;
  providerId: string;
  status: "READY" | "BUSY" | "EXHAUSTED" | "COOLDOWN" | "ERROR" | "DISABLED";
  remainingToday: number | null;
  cooldownUntil: Date | null;
  lastUsedAt: Date | null;
  metadata: Record<string, unknown>;
};

export type GenerationRequest = {
  generationId: string;
  model: string;
  prompt: string;
  config: Record<string, unknown>;
};

export type ProviderSubmission = {
  operationId: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  raw?: Record<string, unknown>;
};

export interface ProviderAdapter {
  submit(request: GenerationRequest, account: ProviderAccountCandidate): Promise<ProviderSubmission>;
  poll(operationId: string, account: ProviderAccountCandidate): Promise<ProviderSubmission>;
}