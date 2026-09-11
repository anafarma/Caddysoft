-- Initial persistence layer for Caddysoft AI Video Studio.
-- Generated to mirror src/lib/db/schema.ts.

CREATE TYPE "project_status" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');
CREATE TYPE "scene_status" AS ENUM ('DRAFT', 'READY', 'GENERATING', 'COMPLETED', 'FAILED', 'ARCHIVED');
CREATE TYPE "asset_kind" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'CHARACTER', 'LOCATION', 'LOGO', 'REFERENCE', 'OTHER');
CREATE TYPE "generation_status" AS ENUM ('QUEUED', 'PREPARING', 'GENERATING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "job_status" AS ENUM ('QUEUED', 'RUNNING', 'RETRYING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "provider_account_status" AS ENUM ('READY', 'BUSY', 'EXHAUSTED', 'COOLDOWN', 'ERROR', 'DISABLED');
CREATE TYPE "provider_type" AS ENUM ('GOOGLE_VEO', 'CUSTOM');

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "auth_subject" text NOT NULL UNIQUE,
  "email" text,
  "name" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "name" text NOT NULL,
  "description" text,
  "status" "project_status" DEFAULT 'ACTIVE' NOT NULL,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "projects_user_status_idx" ON "projects" USING btree ("user_id", "status");
CREATE INDEX "projects_user_created_idx" ON "projects" USING btree ("user_id", "created_at");

CREATE TABLE "scenes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid NOT NULL REFERENCES "projects"("id"),
  "title" text NOT NULL,
  "position" integer NOT NULL,
  "prompt" text,
  "structured_prompt" jsonb,
  "status" "scene_status" DEFAULT 'DRAFT' NOT NULL,
  "duration_seconds" integer,
  "settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "scenes_project_position_idx" ON "scenes" USING btree ("project_id", "position");
CREATE INDEX "scenes_project_status_idx" ON "scenes" USING btree ("project_id", "status");

CREATE TABLE "assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "project_id" uuid REFERENCES "projects"("id"),
  "kind" "asset_kind" NOT NULL,
  "name" text NOT NULL,
  "storage_key" text NOT NULL UNIQUE,
  "mime_type" text,
  "byte_size" integer,
  "duration_ms" integer,
  "width" integer,
  "height" integer,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "deleted_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "assets_user_kind_idx" ON "assets" USING btree ("user_id", "kind");
CREATE INDEX "assets_project_idx" ON "assets" USING btree ("project_id");
CREATE INDEX "assets_deleted_idx" ON "assets" USING btree ("deleted_at");

CREATE TABLE "characters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "project_id" uuid REFERENCES "projects"("id"),
  "name" text NOT NULL,
  "appearance" text,
  "clothing" text,
  "personality" text,
  "consistency_notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "characters_user_idx" ON "characters" USING btree ("user_id");
CREATE INDEX "characters_project_idx" ON "characters" USING btree ("project_id");

CREATE TABLE "character_assets" (
  "character_id" uuid NOT NULL REFERENCES "characters"("id"),
  "asset_id" uuid NOT NULL REFERENCES "assets"("id")
);
CREATE UNIQUE INDEX "character_assets_pk" ON "character_assets" USING btree ("character_id", "asset_id");

CREATE TABLE "locations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "project_id" uuid REFERENCES "projects"("id"),
  "name" text NOT NULL,
  "description" text,
  "visual_details" text,
  "consistency_notes" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "locations_user_idx" ON "locations" USING btree ("user_id");
CREATE INDEX "locations_project_idx" ON "locations" USING btree ("project_id");

CREATE TABLE "location_assets" (
  "location_id" uuid NOT NULL REFERENCES "locations"("id"),
  "asset_id" uuid NOT NULL REFERENCES "assets"("id")
);
CREATE UNIQUE INDEX "location_assets_pk" ON "location_assets" USING btree ("location_id", "asset_id");

CREATE TABLE "styles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id"),
  "name" text NOT NULL,
  "description" text,
  "prompt_preset" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "styles_user_idx" ON "styles" USING btree ("user_id");

CREATE TABLE "providers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" "provider_type" NOT NULL UNIQUE,
  "name" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "provider_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "provider_id" uuid NOT NULL REFERENCES "providers"("id"),
  "label" text NOT NULL,
  "credential_ref" text NOT NULL,
  "status" "provider_account_status" DEFAULT 'READY' NOT NULL,
  "daily_allowance" integer,
  "used_today" integer DEFAULT 0 NOT NULL,
  "remaining_today" integer,
  "first_generation_at" timestamptz,
  "next_refresh_at" timestamptz,
  "cooldown_until" timestamptz,
  "last_used_at" timestamptz,
  "last_error_code" text,
  "last_error_message" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "provider_accounts_eligibility_idx" ON "provider_accounts" USING btree ("user_id", "provider_id", "status", "next_refresh_at");
CREATE UNIQUE INDEX "provider_accounts_user_label_idx" ON "provider_accounts" USING btree ("user_id", "label");

CREATE TABLE "generations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "project_id" uuid NOT NULL REFERENCES "projects"("id"),
  "scene_id" uuid REFERENCES "scenes"("id"),
  "provider_id" uuid NOT NULL REFERENCES "providers"("id"),
  "provider_account_id" uuid REFERENCES "provider_accounts"("id"),
  "model" text NOT NULL,
  "status" "generation_status" DEFAULT 'QUEUED' NOT NULL,
  "prompt_snapshot" text NOT NULL,
  "request_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "provider_operation_id" text,
  "estimated_cost" numeric(18,6),
  "actual_cost" numeric(18,6),
  "error_code" text,
  "error_message" text,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "generations_project_created_idx" ON "generations" USING btree ("project_id", "created_at");
CREATE INDEX "generations_scene_created_idx" ON "generations" USING btree ("scene_id", "created_at");
CREATE INDEX "generations_account_status_idx" ON "generations" USING btree ("provider_account_id", "status");
CREATE UNIQUE INDEX "generations_provider_operation_idx" ON "generations" USING btree ("provider_id", "provider_operation_id");

CREATE TABLE "generation_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "generation_id" uuid NOT NULL REFERENCES "generations"("id"),
  "version_number" integer NOT NULL,
  "request_snapshot" jsonb NOT NULL,
  "response_snapshot" jsonb,
  "output_asset_id" uuid REFERENCES "assets"("id"),
  "created_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "generation_versions_number_idx" ON "generation_versions" USING btree ("generation_id", "version_number");
CREATE INDEX "generation_versions_asset_idx" ON "generation_versions" USING btree ("output_asset_id");

CREATE TABLE "jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "project_id" uuid REFERENCES "projects"("id"),
  "generation_id" uuid REFERENCES "generations"("id"),
  "provider_account_id" uuid REFERENCES "provider_accounts"("id"),
  "type" text NOT NULL,
  "status" "job_status" DEFAULT 'QUEUED' NOT NULL,
  "idempotency_key" text NOT NULL,
  "attempt" integer DEFAULT 1 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "available_at" timestamptz DEFAULT now() NOT NULL,
  "locked_at" timestamptz,
  "started_at" timestamptz,
  "finished_at" timestamptz,
  "error_code" text,
  "error_message" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "jobs_user_idempotency_idx" ON "jobs" USING btree ("user_id", "idempotency_key");
CREATE INDEX "jobs_queue_idx" ON "jobs" USING btree ("status", "available_at");
CREATE INDEX "jobs_project_idx" ON "jobs" USING btree ("project_id");

CREATE TABLE "quota_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_account_id" uuid NOT NULL REFERENCES "provider_accounts"("id"),
  "observed_at" timestamptz DEFAULT now() NOT NULL,
  "daily_allowance" integer,
  "used" integer,
  "remaining" integer,
  "reset_at" timestamptz,
  "source" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
CREATE INDEX "quota_snapshots_account_observed_idx" ON "quota_snapshots" USING btree ("provider_account_id", "observed_at");

CREATE TABLE "usage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "provider_account_id" uuid REFERENCES "provider_accounts"("id"),
  "generation_id" uuid REFERENCES "generations"("id"),
  "job_id" uuid REFERENCES "jobs"("id"),
  "model" text NOT NULL,
  "units" integer,
  "cost" numeric(18,6),
  "status" text NOT NULL,
  "occurred_at" timestamptz DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
CREATE INDEX "usage_events_user_occurred_idx" ON "usage_events" USING btree ("user_id", "occurred_at");
CREATE INDEX "usage_events_account_occurred_idx" ON "usage_events" USING btree ("provider_account_id", "occurred_at");
CREATE INDEX "usage_events_generation_idx" ON "usage_events" USING btree ("generation_id");
