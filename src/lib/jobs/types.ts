export const JOB_TYPES = { GENERATION: "GENERATION", DERIVATIVE: "DERIVATIVE" } as const;
export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

export type GenerationJobPayload = {
  generationId: string;
  providerId: string;
  providerAccountId?: string;
};

export type DerivativeJobPayload = {
  assetId: string;
  derivativeId: string;
  kind: "THUMBNAIL" | "POSTER" | "WAVEFORM";
};

export type JobPayload = GenerationJobPayload | DerivativeJobPayload;
