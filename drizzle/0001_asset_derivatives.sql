CREATE TABLE "asset_derivatives" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_id" uuid NOT NULL REFERENCES "assets"("id"),
  "kind" text NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
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

CREATE UNIQUE INDEX "asset_derivatives_source_kind_idx" ON "asset_derivatives" USING btree ("asset_id", "kind");
CREATE INDEX "asset_derivatives_asset_idx" ON "asset_derivatives" USING btree ("asset_id");
CREATE INDEX "asset_derivatives_status_idx" ON "asset_derivatives" USING btree ("status");
CREATE INDEX "asset_derivatives_deleted_idx" ON "asset_derivatives" USING btree ("deleted_at");
