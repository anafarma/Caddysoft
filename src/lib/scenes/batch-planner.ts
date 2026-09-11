import { buildSceneGenerationSnapshot, listProjectScenes } from "./pipeline";
import { compileScenePrompt, buildSceneGenerationConfig } from "./prompt-compiler";
import { getSceneReferences } from "./references";

export async function planProjectGenerations(userId: string, projectId: string) {
  const scenes = await listProjectScenes(userId, projectId);
  const plan = [];
  for (const scene of scenes) {
    if (scene.status === "ARCHIVED") continue;
    const snapshot = await buildSceneGenerationSnapshot(userId, projectId, scene.id);
    const refs = await getSceneReferences(userId, projectId, scene.id);
    plan.push({
      sceneId: scene.id, position: scene.position, title: scene.title,
      prompt: compileScenePrompt(snapshot), config: buildSceneGenerationConfig(snapshot),
      references: refs,
    });
  }
  return { projectId, generatedAt: new Date().toISOString(), scenes: plan };
}