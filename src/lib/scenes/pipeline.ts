import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/src/lib/db";
import { projects, scenes } from "@/src/lib/db/schema";

export async function listProjectScenes(userId: string, projectId: string) {
  const rows = await getDb().select({ scene: scenes }).from(scenes)
    .innerJoin(projects, eq(scenes.projectId, projects.id))
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId), eq(projects.status, "ACTIVE")))
    .orderBy(asc(scenes.position));
  return rows.map(row => row.scene);
}

export function validateSceneForGeneration(scene: typeof scenes.$inferSelect) {
  if (scene.status === "ARCHIVED") throw new Error("SCENE_ARCHIVED");
  if (!scene.prompt?.trim() && !scene.structuredPrompt) throw new Error("SCENE_PROMPT_REQUIRED");
  if (scene.durationSeconds != null && (scene.durationSeconds < 1 || scene.durationSeconds > 3600)) throw new Error("SCENE_DURATION_INVALID");
  return true;
}

export async function buildSceneGenerationSnapshot(userId: string, projectId: string, sceneId: string) {
  const rows = await getDb().select({ scene: scenes, project: projects }).from(scenes)
    .innerJoin(projects, eq(scenes.projectId, projects.id))
    .where(and(eq(scenes.id, sceneId), eq(scenes.projectId, projectId), eq(projects.userId, userId))).limit(1);
  const row = rows[0];
  if (!row) throw new Error("SCENE_NOT_FOUND");
  validateSceneForGeneration(row.scene);
  return {
    projectId: row.project.id,
    sceneId: row.scene.id,
    title: row.scene.title,
    prompt: row.scene.prompt ?? "",
    structuredPrompt: row.scene.structuredPrompt ?? {},
    durationSeconds: row.scene.durationSeconds,
    settings: row.scene.settings,
  };
}
