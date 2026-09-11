export function validateExportManifest(manifest: {
  projectId: string;
  version: number;
  scenes: Array<{ id: string; position: number; generations: Array<{ status?: string; outputAssetId?: string | null }> }>;
}) {
  if (!manifest.projectId || manifest.version < 1) throw new Error("EXPORT_MANIFEST_INVALID");
  let previous = -Infinity;
  for (const scene of manifest.scenes) {
    if (scene.position < previous) throw new Error("EXPORT_SCENE_ORDER_INVALID");
    previous = scene.position;
    if (!scene.id) throw new Error("EXPORT_SCENE_ID_MISSING");
    for (const generation of scene.generations) {
      if (generation.status === "COMPLETED" && !generation.outputAssetId) throw new Error("COMPLETED_GENERATION_OUTPUT_MISSING");
    }
  }
  return true;
}
