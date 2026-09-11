import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/src/lib/db";
import { assets, generationVersions, generations, projects, scenes } from "@/src/lib/db/schema";

export async function buildProjectExportManifest(userId: string, projectId: string) {
  const rows = await getDb().select({ scene: scenes, generation: generations, version: generationVersions, asset: assets })
    .from(projects)
    .leftJoin(scenes, eq(scenes.projectId, projects.id))
    .leftJoin(generations, eq(generations.sceneId, scenes.id))
    .leftJoin(generationVersions, eq(generationVersions.generationId, generations.id))
    .leftJoin(assets, eq(assets.id, generationVersions.outputAssetId))
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .orderBy(asc(scenes.position), asc(generationVersions.versionNumber));

  const scenesMap = new Map<string, { id: string; position: number; title: string; generations: Array<Record<string, unknown>> }>();
  for (const row of rows) {
    if (!row.scene) continue;
    const item = scenesMap.get(row.scene.id) ?? { id: row.scene.id, position: row.scene.position, title: row.scene.title, generations: [] };
    if (row.generation) item.generations.push({
      id: row.generation.id,
      status: row.generation.status,
      version: row.version?.versionNumber ?? null,
      outputAssetId: row.asset?.id ?? row.version?.outputAssetId ?? null,
    });
    scenesMap.set(row.scene.id, item);
  }
  return { projectId, version: 1, scenes: [...scenesMap.values()].sort((a, b) => a.position - b.position) };
}