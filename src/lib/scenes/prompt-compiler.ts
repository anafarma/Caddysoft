type PromptInput = {
  prompt?: string | null;
  structuredPrompt?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
  durationSeconds?: number | null;
};

function clean(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(clean).filter(Boolean).join(", ");
  if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => { const v = clean(item); return v ? `${key}: ${v}` : ""; })
    .filter(Boolean).join(". ");
  return "";
}

export function compileScenePrompt(input: PromptInput) {
  const parts = [clean(input.prompt), clean(input.structuredPrompt)];
  const settings = clean(input.settings);
  if (settings) parts.push(settings);
  const prompt = parts.filter(Boolean).join("\n");
  if (!prompt) throw new Error("SCENE_PROMPT_REQUIRED");
  return prompt.slice(0, 20000);
}

export function buildSceneGenerationConfig(input: PromptInput) {
  return {
    durationSeconds: input.durationSeconds ?? null,
    source: "M6_SCENE_COMPILER",
  };
}
