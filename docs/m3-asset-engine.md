# M3 — Asset Engine

## Scope

M3 establishes the authenticated asset catalog, private binary storage boundary, browser-direct upload lifecycle, and asynchronous storage cleanup. Assets belong to the signed-in application user and may optionally belong to one of that user's projects.

The engine separates **asset metadata/catalogue** from **binary storage**. `storageKey` identifies the storage object, while the storage adapter handles provider-specific signing and deletion without exposing provider credentials to the browser.

## Current contract

### `GET /api/assets`

Returns active assets for the authenticated user, newest first.

Optional query parameters:
- `projectId` — restrict to one owned project.
- `kind` — `IMAGE | VIDEO | AUDIO | CHARACTER | LOCATION | LOGO | REFERENCE | OTHER`.

### `POST /api/assets`

Registers an already-established asset. Required fields:
- `name`
- `kind`
- `storageKey`

This remains available for provider/import workflows where the binary already exists.

### `POST /api/assets/prepare-upload`

Preferred browser-upload entry point. The server:
1. authenticates the user;
2. validates project ownership and asset metadata;
3. generates a server-controlled storage key under `users/{userId}/assets/`;
4. creates the asset record in `PENDING` state;
5. returns a short-lived signed upload URL.

The browser uploads directly to storage and never receives the Blob store credential.

### `POST /api/assets/[assetId]/complete`

Finalizes a browser upload. The server authenticates ownership, verifies the object exists in private storage, and marks the asset `READY` while persisting authoritative MIME type, byte size, and ETag metadata.

### `POST /api/assets/[assetId]/upload-url`

Legacy/direct storage boundary for an existing asset. Returns a short-lived signed upload URL after ownership verification.

### `GET /api/assets/[assetId]/download-url`

Returns a short-lived signed download URL after ownership verification.

### `GET /api/assets/[assetId]`

Returns one active asset only when it belongs to the authenticated user.

### `DELETE /api/assets/[assetId]`

Soft-deletes an owned asset. The request does not synchronously destroy binary storage.

## Storage provider

The concrete M3 provider is **Vercel Blob Private Storage** through `@vercel/blob`.

The storage adapter requires `BLOB_READ_WRITE_TOKEN`; Vercel runtime presence alone is not treated as sufficient configuration. This prevents a deployment from appearing healthy while storage credentials are absent.

The adapter uses operation-scoped signed URLs:
- upload: 15 minutes
- download: 5 minutes

## Security invariants

1. Every asset read/write is scoped by `userId`.
2. Project assignment is validated through the same user-scoped project lookup.
3. Deleted assets are excluded from normal catalog reads.
4. Browser clients never receive the Blob store credential.
5. Browser upload paths are generated server-side.
6. Upload/download URLs are short-lived and operation-scoped.
7. Uploaded bytes are verified from storage before an asset is marked `READY`.
8. Asset metadata has bounded string fields and non-negative numeric validation.
9. Cleanup is authenticated independently through `CRON_SECRET`.

## Lifecycle

`prepare-upload → PENDING → browser PUT → complete → READY → soft delete → asynchronous storage cleanup`

Cleanup policy:
- stale `PENDING` records older than 24 hours are reconciled;
- soft-deleted assets older than 7 days are eligible for binary deletion;
- successful storage deletion is recorded in metadata as `storageDeletedAt`;
- database records are retained for referential integrity and auditability.

The cleanup worker processes bounded batches so a large backlog does not turn one invocation into an unbounded operation.

## Scheduled cleanup

Vercel Cron invokes `/api/cron/assets-cleanup` daily at `03:20 UTC`.

The endpoint requires:
`Authorization: Bearer $CRON_SECRET`

The route never accepts a user-supplied storage key and only operates on database-selected asset records.

## UI

The Asset Library is available at `/assets` and is backed by the authenticated asset APIs. It supports catalog filtering, image/video previews, direct-to-Blob upload, completion verification, and soft deletion.

## M3 completion criteria

- [x] Asset data model
- [x] User/project ownership
- [x] Authenticated catalog API
- [x] Asset lookup
- [x] Soft delete
- [x] Provider-neutral storage boundary
- [x] Vercel Blob private-storage adapter
- [x] Signed upload/download URLs
- [x] Browser-direct upload lifecycle
- [x] Storage verification before READY
- [x] Stale PENDING reconciliation
- [x] Soft-delete storage cleanup
- [x] Scheduled cleanup route
- [x] Asset Library UI
- [ ] Live deployment verification with configured Blob + database
- [ ] Dedicated media thumbnail/transcoding pipeline

The remaining unchecked items are intentionally environment/runtime work or a separate media-processing layer, not missing catalog/storage primitives.
