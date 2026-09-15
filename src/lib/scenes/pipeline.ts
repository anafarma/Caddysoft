import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { getDb } from "@/src/lib/db";
import { assets, characters, generationVersions, generations, locations, projects, scenes, styles } from "@/src/lib/db/schema";

const MAX_TITLE_LENGTH = 200;
const MAX_PROMPT_LENGTH = 20_000;

type SceneInput = {
  title: string;
  position?: number;
  prompt?: string | null;
  structuredPrompt?: Record<string, unknown> | null;
  durationSeconds?: number | null;
  settings?: Record<string, unknown>;
};

function validateSceneInput(input: SceneInput) {
  const title = input.title.trim();
  if (!title || title.length > MAX_TITLE_LENGTH) throw new Error("INVALID_SCENE_TITLE");
  if (input.position != null && (!Number.isSafeInteger(input.position) || input.position < 0)) throw new Error("INVALID_SCENE_POSITION");
  if (input.prompt != null && input.prompt.length > MAX_PROMPT_LENGTH) throw new Error("INVALID_SCENE_PROMPT");
  if (input.durationSeconds != null && (!Number.isSafeInteger(input.durationSeconds) || input.durationSeconds < 1 || input.durationSeconds > 3600)) throw new Error("SCENE_DURATION_INVALID");
  return title;
}

async function getOwnedActiveProject(userId: string, projectId: string) {
  const rows = await getDb().select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId), eq(projects.status, "ACTIVE"))).limit(1);
  return rows[0] ?? null;
}

export async function listProjectScenes(userId: string, projectId: string) {
  const rows = await getDb().select({ scene: scenes }).from(scenes)
    .innerJoin(projects, eq(scenes.projectId, projects.id))
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId), eq(projects.status, "ACTIVE")))
    .orderBy(asc(scenes.position), asc(scenes.id));
  return rows.map(row => row.scene);
}

export async function createScene(userId: string, projectId: string, input: SceneInput) {
  if (!(await getOwnedActiveProject(userId, projectId))) throw new Error("PROJECT_NOT_FOUND");
  const title = validateSceneInput(input);
  let position = input.position;
  if (position == null) {
    const rows = await getDb().select({ max: sql<number>`COALESCE(MAX(${scenes.position}), -1)` }).from(scenes).where(eq(scenes.projectId, projectId));
    position = Number(rows[0]?.max ?? -1) + 1;
  }
  const rows = await getDb().insert(scenes).values({ projectId, title, position, prompt: input.prompt?.trim() || null, structuredPrompt: input.structuredPrompt ?? null, status: "DRAFT", durationSeconds: input.durationSeconds ?? null, settings: input.settings ?? {} }).returning();
  if (!rows[0]) throw new Error("SCENE_CREATE_FAILED");
  return rows[0];
}

export async function updateScene(userId: string, projectId: string, sceneId: string, input: Partial<SceneInput>, expectedUpdatedAt?: string) {
  if (!(await getOwnedActiveProject(userId, projectId))) throw new Error("PROJECT_NOT_FOUND");
  const current = (await getDb().select().from(scenes).where(and(eq(scenes.id, sceneId), eq(scenes.projectId, projectId))).limit(1))[0];
  if (!current) throw new Error("SCENE_NOT_FOUND");
  if (current.status === "ARCHIVED") throw new Error("SCENE_ARCHIVED");
  if (expectedUpdatedAt && current.updatedAt.toISOString() !== expectedUpdatedAt) throw new Error("SCENE_CONFLICT");

  const values: Partial<typeof scenes.$inferInsert> = { updatedAt: new Date() };
  if (input.title !== undefined) values.title = validateSceneInput({ ...current, ...input, title: input.title });
  if (input.position !== undefined) {
    if (!Number.isSafeInteger(input.position) || input.position < 0) throw new Error("INVALID_SCENE_POSITION");
    values.position = input.position;
  }
  if (input.prompt !== undefined) {
    if (input.prompt != null && input.prompt.length > MAX_PROMPT_LENGTH) throw new Error("INVALID_SCENE_PROMPT");
    values.prompt = input.prompt?.trim() || null;
  }
  if (input.structuredPrompt !== undefined) values.structuredPrompt = input.structuredPrompt;
  if (input.durationSeconds !== undefined) {
    if (input.durationSeconds != null && (!Number.isSafeInteger(input.durationSeconds) || input.durationSeconds < 1 || input.durationSeconds > 3600)) throw new Error("SCENE_DURATION_INVALID");
    values.durationSeconds = input.durationSeconds;
  }
  if (input.settings !== undefined) values.settings = input.settings;

  const conditions = [eq(scenes.id, sceneId), eq(scenes.projectId, projectId)];
  if (expectedUpdatedAt) conditions.push(eq(scenes.updatedAt, new Date(expectedUpdatedAt)));
  const rows = await getDb().update(scenes).set(values).where(and(...conditions)).returning();
  if (!rows[0]) throw new Error("SCENE_CONFLICT");
  return rows[0];
}

export async function archiveScene(userId: string, projectId: string, sceneId: string, expectedUpdatedAt?: string) {
  if (!(await getOwnedActiveProject(userId, projectId))) throw new Error("PROJECT_NOT_FOUND");
  const conditions = [eq(scenes.id, sceneId), eq(scenes.projectId, projectId)];
  if (expectedUpdatedAt) conditions.push(eq(scenes.updatedAt, new Date(expectedUpdatedAt)));
  const rows = await getDb().update(scenes).set({ status: "ARCHIVED", updatedAt: new Date() }).where(and(...conditions)).returning();
  if (!rows[0]) throw new Error(expectedUpdatedAt ? "SCENE_CONFLICT" : "SCENE_NOT_FOUND");
  return rows[0];
}

export function validateSceneForGeneration(scene: typeof scenes.$inferSelect) {
  if (scene.status === "ARCHIVED") throw new Error("SCENE_ARCHIVED");
  if (!scene.prompt?.trim() && !scene.structuredPrompt) throw new Error("SCENE_PROMPT_REQUIRED");
  if (scene.durationSeconds != null && (scene.durationSeconds < 1 || scene.durationSeconds > 3600)) throw new Error("SCENE_DURATION_INVALID");
  return true;
}

function compileStructuredPrompt(value: Record<string, unknown>) {
  const orderedKeys = ["subject", "action", "environment", "camera", "lighting", "style", "composition", "motion", "audio", "negativePrompt"];
  return orderedKeys.filter(key => typeof value[key] === "string" && String(value[key]).trim()).map(key => `${key}: ${String(value[key]).trim()}`).join(". ");
}

export async function buildSceneGenerationSnapshot(userId: string, projectId: string, sceneId: string, references: { characterIds?: string[]; locationIds?: string[]; styleIds?: string[] } = {}) {
  const row = (await getDb().select({ scene: scenes, project: projects }).from(scenes).innerJoin(projects, eq(scenes.projectId, projects.id)).where(and(eq(scenes.id, sceneId), eq(scenes.projectId, projectId), eq(projects.userId, userId), eq(projects.status, "ACTIVE"))).limit(1))[0];
  if (!row) throw new Error("SCENE_NOT_FOUND");
  validateSceneForGeneration(row.scene);

  const characterIds = [...new Set(references.characterIds ?? [])];
  const locationIds = [...new Set(references.locationIds ?? [])];
  const styleIds = [...new Set(references.styleIds ?? [])];
  const [characterRows, locationRows, styleRows] = await Promise.all([
    characterIds.length ? getDb().select().from(characters).where(and(eq(characters.userId, userId), inArray(characters.id, characterIds))) : [],
    locationIds.length ? getDb().select().from(locations).where(and(eq(locations.userId, userId), inArray(locations.id, locationIds))) : [],
    styleIds.length ? getDb().select().from(styles).where(and(inArray(styles.id, styleIds), sql`(${styles.userId} = ${userId} OR ${styles.userId} IS NULL)`)) : [],
  ]);
  if (characterRows.length !== characterIds.length || locationRows.length !== locationIds.length || styleRows.length !== styleIds.length) throw new Error("SCENE_REFERENCE_NOT_FOUND");

  const structuredPrompt = row.scene.structuredPrompt ?? {};
  const compiledParts = [row.scene.prompt?.trim() || compileStructuredPrompt(structuredPrompt)];
  for (const character of characterRows) compiledParts.push(`Character ${character.name}: ${[character.appearance, character.clothing, character.personality].filter(Boolean).join("; ")}`);
  for (const location of locationRows) compiledParts.push(`Location ${location.name}: ${[location.description, location.visualDetails].filter(Boolean).join("; ")}`);
  for (const style of styleRows) compiledParts.push(`Style ${style.name}: ${style.promptPreset}`);

  return { projectId: row.project.id, sceneId: row.scene.id, title: row.scene.title, prompt: compiledParts.filter(Boolean).join("\n\n"), structuredPrompt, durationSeconds: row.scene.durationSeconds, settings: row.scene.settings, references: { characters: characterRows.map(item => item.id), locations: locationRows.map(item => item.id), styles: styleRows.map(item => item.id) }, plannedAt: new Date().toISOString() };
}

export async function buildProjectGenerationPlan(userId: string, projectId: string) {
  if (!(await getOwnedActiveProject(userId, projectId))) throw new Error("PROJECT_NOT_FOUND");
  const sceneList = await listProjectScenes(userId, projectId);
  return Promise.all(sceneList.filter(scene => scene.status !== "ARCHIVED").map(scene => buildSceneGenerationSnapshot(userId, projectId, scene.id)));
}

export async function buildProjectRenderManifest(userId: string, projectId: string) {
  if (!(await getOwnedActiveProject(userId, projectId))) throw new Error("PROJECT_NOT_FOUND");
  const sceneList = await listProjectScenes(userId, projectId);
  const generationRows = await getDb().select({ generation: generations, version: generationVersions, asset: assets })
    .from(generations)
    .innerJoin(generationVersions, and(eq(generationVersions.generationId, generations.id), isNotNull(generationVersions.outputAssetId)))
    .innerJoin(assets, and(eq(assets.id, generationVersions.outputAssetId!), eq(assets.userId, userId), isNull(assets.deletedAt)))
    .where(and(eq(generations.projectId, projectId), eq(generations.userId, userId), eq(generations.status, "COMPLETED")))
    .orderBy(desc(generations.createdAt), desc(generationVersions.versionNumber));

  const latestByScene = new Map<string, typeof generationRows[number]>();
  for (const row of generationRows) if (row.generation.sceneId && !latestByScene.has(row.generation.sceneId)) latestByScene.set(row.generation.sceneId, row);

  let cursorSeconds = 0;
  const clips = sceneList.filter(scene => scene.status !== "ARCHIVED").map(scene => {
    const row = latestByScene.get(scene.id);
    const durationSeconds = scene.durationSeconds ?? 0;
    const clip = { sceneId: scene.id, position: scene.position, title: scene.title, assetId: row?.asset.id ?? null, generationId: row?.generation.id ?? null, durationSeconds, startSeconds: cursorSeconds, endSeconds: cursorSeconds + durationSeconds, ready: Boolean(row) };
    cursorSeconds += durationSeconds;
    return clip;
  });
  return { projectId, version: 1, generatedAt: new Date().toISOString(), durationSeconds: cursorSeconds, ready: clips.every(clip => clip.ready), clips };
}
