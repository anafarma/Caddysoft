import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, numeric, index, uniqueIndex, pgEnum } from "drizzle-orm/pg-core";

export const projectStatus = pgEnum("project_status", ["ACTIVE", "ARCHIVED", "DELETED"]);
export const sceneStatus = pgEnum("scene_status", ["DRAFT", "READY", "GENERATING", "COMPLETED", "FAILED", "ARCHIVED"]);
export const assetKind = pgEnum("asset_kind", ["IMAGE", "VIDEO", "AUDIO", "CHARACTER", "LOCATION", "LOGO", "REFERENCE", "OTHER"]);
export const generationStatus = pgEnum("generation_status", ["QUEUED", "PREPARING", "GENERATING", "COMPLETED", "FAILED", "CANCELLED"]);
export const jobStatus = pgEnum("job_status", ["QUEUED", "RUNNING", "RETRYING", "SUCCEEDED", "FAILED", "CANCELLED"]);
export const providerAccountStatus = pgEnum("provider_account_status", ["READY", "BUSY", "EXHAUSTED", "COOLDOWN", "ERROR", "DISABLED"]);
export const providerType = pgEnum("provider_type", ["GOOGLE_VEO", "CUSTOM"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  authSubject: text("auth_subject").notNull().unique(),
  email: text("email"),
  name: text("name"),
  ...timestamps,
});

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  status: projectStatus("status").default("ACTIVE").notNull(),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
  ...timestamps,
}, (t) => [index("projects_user_status_idx").on(t.userId, t.status), index("projects_user_created_idx").on(t.userId, t.createdAt)]);

export const scenes = pgTable("scenes", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  position: integer("position").notNull(),
  prompt: text("prompt"),
  structuredPrompt: jsonb("structured_prompt").$type<Record<string, unknown>>(),
  status: sceneStatus("status").default("DRAFT").notNull(),
  durationSeconds: integer("duration_seconds"),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}).notNull(),
  ...timestamps,
}, (t) => [index("scenes_project_position_idx").on(t.projectId, t.position), index("scenes_project_status_idx").on(t.projectId, t.status)]);

export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  projectId: uuid("project_id").references(() => projects.id),
  kind: assetKind("kind").notNull(),
  name: text("name").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  mimeType: text("mime_type"),
  byteSize: integer("byte_size"),
  durationMs: integer("duration_ms"),
  width: integer("width"),
  height: integer("height"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [index("assets_user_kind_idx").on(t.userId, t.kind), index("assets_project_idx").on(t.projectId), index("assets_deleted_idx").on(t.deletedAt)]);

export const assetDerivatives = pgTable("asset_derivatives", {
  id: uuid("id").defaultRandom().primaryKey(),
  assetId: uuid("asset_id").notNull().references(() => assets.id),
  kind: text("kind").notNull(),
  status: text("status").default("PENDING").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  mimeType: text("mime_type"),
  byteSize: integer("byte_size"),
  durationMs: integer("duration_ms"),
  width: integer("width"),
  height: integer("height"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [
  uniqueIndex("asset_derivatives_source_kind_idx").on(t.assetId, t.kind),
  index("asset_derivatives_asset_idx").on(t.assetId),
  index("asset_derivatives_status_idx").on(t.status),
  index("asset_derivatives_deleted_idx").on(t.deletedAt),
]);

export const characters = pgTable("characters", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  projectId: uuid("project_id").references(() => projects.id),
  name: text("name").notNull(),
  appearance: text("appearance"),
  clothing: text("clothing"),
  personality: text("personality"),
  consistencyNotes: text("consistency_notes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  ...timestamps,
}, (t) => [index("characters_user_idx").on(t.userId), index("characters_project_idx").on(t.projectId)]);

export const characterAssets = pgTable("character_assets", {
  characterId: uuid("character_id").notNull().references(() => characters.id),
  assetId: uuid("asset_id").notNull().references(() => assets.id),
}, (t) => [uniqueIndex("character_assets_pk").on(t.characterId, t.assetId)]);

export const locations = pgTable("locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  projectId: uuid("project_id").references(() => projects.id),
  name: text("name").notNull(),
  description: text("description"),
  visualDetails: text("visual_details"),
  consistencyNotes: text("consistency_notes"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  ...timestamps,
}, (t) => [index("locations_user_idx").on(t.userId), index("locations_project_idx").on(t.projectId)]);

export const locationAssets = pgTable("location_assets", {
  locationId: uuid("location_id").notNull().references(() => locations.id),
  assetId: uuid("asset_id").notNull().references(() => assets.id),
}, (t) => [uniqueIndex("location_assets_pk").on(t.locationId, t.assetId)]);

export const styles = pgTable("styles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  promptPreset: text("prompt_preset").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  ...timestamps,
}, (t) => [index("styles_user_idx").on(t.userId)]);

export const providers = pgTable("providers", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: providerType("type").notNull(),
  name: text("name").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("providers_type_idx").on(t.type)]);

export const providerAccounts = pgTable("provider_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  providerId: uuid("provider_id").notNull().references(() => providers.id),
  label: text("label").notNull(),
  credentialRef: text("credential_ref").notNull(),
  status: providerAccountStatus("status").default("READY").notNull(),
  dailyAllowance: integer("daily_allowance"),
  usedToday: integer("used_today").default(0).notNull(),
  remainingToday: integer("remaining_today"),
  firstGenerationAt: timestamp("first_generation_at", { withTimezone: true }),
  nextRefreshAt: timestamp("next_refresh_at", { withTimezone: true }),
  cooldownUntil: timestamp("cooldown_until", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  lastErrorCode: text("last_error_code"),
  lastErrorMessage: text("last_error_message"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  ...timestamps,
}, (t) => [index("provider_accounts_eligibility_idx").on(t.userId, t.providerId, t.status, t.nextRefreshAt), uniqueIndex("provider_accounts_user_label_idx").on(t.userId, t.label)]);

export const generations = pgTable("generations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  sceneId: uuid("scene_id").references(() => scenes.id),
  providerId: uuid("provider_id").notNull().references(() => providers.id),
  providerAccountId: uuid("provider_account_id").references(() => providerAccounts.id),
  model: text("model").notNull(),
  status: generationStatus("status").default("QUEUED").notNull(),
  promptSnapshot: text("prompt_snapshot").notNull(),
  requestConfig: jsonb("request_config").$type<Record<string, unknown>>().default({}).notNull(),
  providerOperationId: text("provider_operation_id"),
  estimatedCost: numeric("estimated_cost", { precision: 18, scale: 6 }),
  actualCost: numeric("actual_cost", { precision: 18, scale: 6 }),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
}, (t) => [index("generations_project_created_idx").on(t.projectId, t.createdAt), index("generations_scene_created_idx").on(t.sceneId, t.createdAt), index("generations_account_status_idx").on(t.providerAccountId, t.status), uniqueIndex("generations_provider_operation_idx").on(t.providerId, t.providerOperationId)]);

export const generationVersions = pgTable("generation_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  generationId: uuid("generation_id").notNull().references(() => generations.id),
  versionNumber: integer("version_number").notNull(),
  requestSnapshot: jsonb("request_snapshot").$type<Record<string, unknown>>().notNull(),
  responseSnapshot: jsonb("response_snapshot").$type<Record<string, unknown>>(),
  outputAssetId: uuid("output_asset_id").references(() => assets.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => [uniqueIndex("generation_versions_number_idx").on(t.generationId, t.versionNumber), index("generation_versions_asset_idx").on(t.outputAssetId)]);

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  projectId: uuid("project_id").references(() => projects.id),
  generationId: uuid("generation_id").references(() => generations.id),
  providerAccountId: uuid("provider_account_id").references(() => providerAccounts.id),
  type: text("type").notNull(),
  status: jobStatus("status").default("QUEUED").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  attempt: integer("attempt").default(1).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  payload: jsonb("payload").$type<Record<string, unknown>>().default({}).notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("jobs_user_idempotency_idx").on(t.userId, t.idempotencyKey), index("jobs_queue_idx").on(t.status, t.availableAt), index("jobs_project_idx").on(t.projectId)]);

export const quotaSnapshots = pgTable("quota_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  providerAccountId: uuid("provider_account_id").notNull().references(() => providerAccounts.id),
  observedAt: timestamp("observed_at", { withTimezone: true }).defaultNow().notNull(),
  dailyAllowance: integer("daily_allowance"),
  used: integer("used"),
  remaining: integer("remaining"),
  resetAt: timestamp("reset_at", { withTimezone: true }),
  source: text("source").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
}, (t) => [index("quota_snapshots_account_observed_idx").on(t.providerAccountId, t.observedAt)]);

export const usageEvents = pgTable("usage_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  providerAccountId: uuid("provider_account_id").references(() => providerAccounts.id),
  generationId: uuid("generation_id").references(() => generations.id),
  jobId: uuid("job_id").references(() => jobs.id),
  model: text("model").notNull(),
  units: integer("units"),
  cost: numeric("cost", { precision: 18, scale: 6 }),
  status: text("status").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
}, (t) => [uniqueIndex("usage_events_generation_unique_idx").on(t.generationId), index("usage_events_user_occurred_idx").on(t.userId, t.occurredAt), index("usage_events_account_occurred_idx").on(t.providerAccountId, t.occurredAt), index("usage_events_generation_idx").on(t.generationId)]);

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Scene = typeof scenes.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type AssetDerivative = typeof assetDerivatives.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type Job = typeof jobs.$inferSelect;
