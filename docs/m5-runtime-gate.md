# M5 Runtime Gate — Caddysoft

Date: 2026-09-11

## Status

**BLOCKED — runtime environment not established.**

The source-side M5 path is now prepared for a real end-to-end run:

`GENERATION job → atomic provider-account claim → provider submit → provider operation polling → provider output download → private Blob upload → asset row → generation version → generation completion → usage event → provider account READY`

## Source-side fixes completed before runtime validation

1. Provider output is carried by the adapter contract.
2. Google Veo uses the provider account's opaque `credentialRef` directly.
3. Completed Veo output is downloaded server-side with the provider credential and exposed to the orchestration layer as a stream.
4. Completed output is persisted to a private Vercel Blob object.
5. The Blob object is represented by a user/project-scoped `assets` row.
6. `generation_versions.outputAssetId` is populated with the output asset.
7. Completion records a usage event idempotently per generation.
8. Output completion is retry-safe: an existing generation version with an output asset prevents duplicate materialization.
9. Failed materialization cleans up the Blob object and soft-deletes the temporary asset row.
10. A GitHub Actions build workflow was added for `npm ci && npm run build`.

## Runtime proof still required

A dedicated Caddysoft Vercel project must exist and be linked to `anafarma/Caddysoft`. It must not be `apotek-ana` or `anafarma-dev-preview`.

Required runtime configuration:

- Clerk publishable/secret keys
- `DATABASE_URL`
- `CRON_SECRET`
- `CADDYSOFT_CREDENTIAL_GOOGLE_MAIN` (or another configured credential reference)
- private Vercel Blob store connected to the dedicated Caddysoft project
- provider and provider-account database rows

Then run one controlled generation and verify all of the following:

1. Job is claimed exactly once.
2. Provider account changes READY → BUSY atomically.
3. Veo submission returns a real operation ID.
4. Poll jobs continue until `done=true`.
5. Output video is downloaded from Google.
6. Output video is stored in private Blob.
7. Asset row exists and is owned by the correct user/project.
8. Generation version exists and points to the output asset.
9. Generation becomes COMPLETED.
10. Provider account returns to READY.
11. Exactly one usage event exists for the generation.
12. Signed download URL can read the private output.
13. Runtime logs contain no secret leakage and no unhandled errors.

## Safety boundary

No deployment or runtime test should target Ana Farma production (`apotek-ana`) or `anafarma-dev-preview`.
