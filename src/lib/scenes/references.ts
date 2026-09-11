import { and, eq } from "drizzle-orm";
import { getDb } from "@/src/lib/db";
import { characterAssets, characters, locationAssets, locations, scenes, projects, assets } from "@/src/lib/db/schema";

export async function getSceneReferences(userId: string, projectId: string, sceneId: string) {
  const scene = (await getDb().select({ scene: scenes }).from(scenes).innerJoin(projects, eq(scenes.projectId, projects.id))
    .where(and(eq(scenes.id, sceneId), eq(scenes.projectId, projectId), eq(projects.userId, userId))).limit(1))[0]?.scene;
  if (!scene) throw new Error("SCENE_NOT_FOUND");
  const chars = await getDb().select({ character: characters, asset: assets }).from(characters)
    .innerJoin(characterAssets, eq(characterAssets.characterId, characters.id)).innerJoin(assets, eq(assets.id, characterAssets.assetId))
    .where(and(eq(characters.userId, userId), eq(characters.projectId, projectId)));
  const locs = await getDb().select({ location: locations, asset: assets }).from(locations)
    .innerJoin(locationAssets, eq(locationAssets.locationId, locations.id)).innerJoin(assets, eq(assets.id, locationAssets.assetId))
    .where(and(eq(locations.userId, userId), eq(locations.projectId, projectId)));
  return { scene, characters: chars, locations: locs };
}