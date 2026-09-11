import { resolveProviderCredential } from "./registry";
import type { GenerationRequest, ProviderAccountCandidate, ProviderAdapter, ProviderSubmission } from "./types";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function apiKey(credentials: Record<string, string>) {
  const key = credentials.GEMINI_API_KEY || credentials.GOOGLE_API_KEY;
  if (!key) throw new Error("GOOGLE_VEO_CREDENTIAL_MISSING");
  return key;
}

function modelName(model: string) {
  return model.startsWith("models/") ? model.slice("models/".length) : model;
}

async function parse(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GOOGLE_VEO_HTTP_${response.status}:${JSON.stringify(body).slice(0, 1000)}`);
  return body as Record<string, any>;
}

export const googleVeoAdapter: ProviderAdapter = {
  async submit(request: GenerationRequest, account: ProviderAccountCandidate): Promise<ProviderSubmission> {
    const credentials = await resolveProviderCredential(account.metadata.credentialRef as string);
    const key = apiKey(credentials);
    const response = await fetch(`${BASE_URL}/models/${encodeURIComponent(modelName(request.model))}:predictLongRunning`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ instances: [{ prompt: request.prompt }], parameters: request.config }),
      cache: "no-store",
    });
    const body = await parse(response);
    if (typeof body.name !== "string") throw new Error("GOOGLE_VEO_OPERATION_MISSING");
    return { operationId: body.name, status: "QUEUED", raw: body };
  },

  async poll(operationId: string, account: ProviderAccountCandidate): Promise<ProviderSubmission> {
    const credentials = await resolveProviderCredential(account.metadata.credentialRef as string);
    const key = apiKey(credentials);
    const operationPath = operationId.startsWith("http") ? operationId : `${BASE_URL}/${operationId.replace(/^\\/+/, "")}`;
    const response = await fetch(operationPath, { headers: { "x-goog-api-key": key }, cache: "no-store" });
    const body = await parse(response);
    if (body.error) throw new Error(`GOOGLE_VEO_OPERATION_ERROR:${JSON.stringify(body.error).slice(0, 1000)}`);
    if (!body.done) return { operationId, status: "RUNNING", raw: body };
    if (body.response?.generateVideoResponse?.generatedSamples?.length) return { operationId, status: "COMPLETED", raw: body };
    return { operationId, status: "FAILED", raw: body };
  },
};
