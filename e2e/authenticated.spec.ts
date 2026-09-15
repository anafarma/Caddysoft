import { expect, test } from "@playwright/test";
import { clerk } from "@clerk/testing/playwright";

const projectName = "[E2E] Caddysoft authenticated gate";

test.describe("authenticated application gate", () => {
  test("Clerk session protects and unlocks the application", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Create something cinematic." })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    const projectsResponse = await page.request.get("/api/projects");
    expect(projectsResponse.ok()).toBeTruthy();
    const projectsBody = await projectsResponse.json();
    expect(Array.isArray(projectsBody.data)).toBeTruthy();

    const existing = projectsBody.data.find((project: { name?: string }) => project.name === projectName);
    const project = existing ?? (await (async () => {
      const response = await page.request.post("/api/projects", {
        data: { name: projectName, description: "Automated authenticated E2E gate project" },
      });
      expect(response.status()).toBe(201);
      return (await response.json()).data;
    })());

    expect(project.id).toBeTruthy();

    const scenesResponse = await page.request.get(`/api/projects/${project.id}/scenes`);
    expect(scenesResponse.ok()).toBeTruthy();
    const scenesBody = await scenesResponse.json();
    expect(Array.isArray(scenesBody.data)).toBeTruthy();

    let scene = scenesBody.data.find((item: { title?: string; archivedAt?: string | null }) => item.title === "E2E Scene" && !item.archivedAt);
    if (!scene) {
      const response = await page.request.post(`/api/projects/${project.id}/scenes`, {
        data: {
          title: "E2E Scene",
          position: 0,
          prompt: "A cinematic pharmacy product shot for automated testing.",
          durationSeconds: 4,
          settings: { source: "authenticated-e2e" },
        },
      });
      expect(response.status()).toBe(201);
      scene = (await response.json()).data;
    }

    expect(scene.id).toBeTruthy();
    expect(scene.updatedAt).toBeTruthy();

    const updateResponse = await page.request.patch(`/api/projects/${project.id}/scenes/${scene.id}`, {
      data: {
        title: "E2E Scene Updated",
        expectedUpdatedAt: scene.updatedAt,
      },
    });
    expect(updateResponse.ok()).toBeTruthy();
    const updatedScene = (await updateResponse.json()).data;
    expect(updatedScene.title).toBe("E2E Scene Updated");
    expect(updatedScene.updatedAt).toBeTruthy();

    const conflictResponse = await page.request.patch(`/api/projects/${project.id}/scenes/${scene.id}`, {
      data: {
        title: "E2E Stale Write Must Fail",
        expectedUpdatedAt: scene.updatedAt,
      },
    });
    expect(conflictResponse.status()).toBe(409);

    const manifestResponse = await page.request.get(`/api/projects/${project.id}/export-manifest`);
    expect(manifestResponse.ok()).toBeTruthy();
    const manifestBody = await manifestResponse.json();
    expect(manifestBody.data).toBeTruthy();

    const archiveResponse = await page.request.delete(`/api/projects/${project.id}/scenes/${scene.id}`, {
      data: { expectedUpdatedAt: updatedScene.updatedAt },
    });
    expect(archiveResponse.ok()).toBeTruthy();
  });

  test("logout returns the browser to the protected-route boundary", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Create something cinematic." })).toBeVisible();

    await clerk.signOut({ page });
    await page.goto("/");

    await expect(page).toHaveURL(/\/sign-in/);
  });
});
