import { desc, eq, and } from "drizzle-orm";
import { getDb } from "./index";
import { projects, scenes } from "./schema";

/** All project reads are scoped by the authenticated application user. */
export async function listProjects(userId: string) {
  return getDb().select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt));
}

export async function getProject(userId: string, projectId: string) {
  const rows = await getDb()
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listScenes(userId: string, projectId: string) {
  const project = await getProject(userId, projectId);
  if (!project) return null;
  return getDb().select().from(scenes).where(eq(scenes.projectId, projectId)).orderBy(scenes.position);
}
