import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/src/lib/db";
import { assets, generations, projects, scenes } from "@/src/lib/db/schema";

export async function buildProjectExportManifest(userId: string, projectId: string) {
  const rows = await getDb().select({ project: projects, scene: scenes, generation: generations, asset: assets })
    .from(projects).leftJoin(scenes, eq(scenes.projectId, projects.id))
    .leftJoin(generations, eq(generations.sceneId, scenes.id)).leftJoin(assets, eq(assets.id, generations.providerAccountId))
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId))).orderBy(asc(scenes.position));
  const scenesMap = new Map<string, any>();
  for (const row of rows) {
    if (!row.scene) continue;
    const item = scenesMap.get(row.scene.id) ?? { id: row.scene.id, position: row.scene.position, title: row.scene.title, generations: [] };
    if (row.generation) item.generations.push({ id: row.generation.id, status: row.generation.status, outputAssetId: row.asset?.id ?? null });
    scenesMap.set(row.scene.id, item);
  }
  return { projectId, version: 1, scenes: [...scenesMap.values()].sort((a,b)=>a.position-b.position) };
}