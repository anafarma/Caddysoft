import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

setup.describe.configure({ mode: "serial" });

const authFile = path.resolve("playwright/.clerk/user.json");

setup("configure Clerk testing", async () => {
  await clerkSetup();
});

setup("authenticate E2E test user", async ({ page }) => {
  const emailAddress = process.env.E2E_CLERK_USER_EMAIL;
  if (!emailAddress) {
    throw new Error("E2E_CLERK_USER_EMAIL is required for authenticated E2E tests.");
  }

  await page.goto("/sign-in");
  await clerk.signIn({ page, emailAddress });
  await page.goto("/");

  await page.getByRole("heading", { name: "Create something cinematic." }).waitFor();
  await fs.mkdir(path.dirname(authFile), { recursive: true });
  await page.context().storageState({ path: authFile });
});
