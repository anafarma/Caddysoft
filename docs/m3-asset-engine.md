# M3 — Asset Engine

## Scope

M3 establishes the authenticated asset catalog and the storage lifecycle boundary. Assets belong to the signed-in application user and may optionally belong to one of that user's projects.

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

Finalizes a browser upload. The server authenticates ownership, verifies the object exists in storage using provider metadata, and marks the asset `READY` while persisting authoritative MIME type, byte size, and ETag metadata.

### `POST /api/assets/[assetId]/upload-url`

Legacy/direct storage boundary for an existing asset. Returns a short-lived signed upload URL after ownership verification.

### `GET /api/assets/[assetId]/download-url`

Returns a short-lived signed download URL after ownership verification.

### `GET /api/assets/[assetId]`

Returns one active asset only when it belongs to the authenticated user.

### `DELETE /api/assets/[assetId]`

Soft-deletes an owned asset. Binary cleanup remains decoupled from catalog deletion so retention and asynchronous cleanup can be introduced without making the request path destructive.

## Storage provider

The concrete M3 provider is **Vercel Blob Private Storage** through `@vercel/blob`. Upload and download access is granted with narrowly scoped signed URLs; the application server retains the storage credential/OIDC capability and the browser receives only an operation-specific URL.

The adapter uses short TTLs:
- upload: 15 minutes
- download: 5 minutes

Vercel Blob signed URLs support operation scoping (`put`/`get`) and expiration, which matches the provider-neutral storage boundary. See the official Vercel documentation for the current signed-URL model. 

## Security invariants

1. Every asset read/write is scoped by `userId`.
2. Project assignment is validated through the same user-scoped project lookup.
3. Deleted assets are excluded from normal catalog reads.
4. Browser clients never receive the Blob read/write credential.
5. Browser upload paths are generated server-side rather than accepted from the client.
6. Upload/download URLs are short-lived and operation-scoped.
7. Uploaded bytes are verified from storage before an asset is marked `READY`.
8. Asset metadata has bounded string fields and non-negative numeric validation.

## Lifecycle

`prepare-upload → PENDING → browser PUT → complete → READY → soft delete → asynchronous storage cleanup`

A failed preparation does not attempt an unsafe compensating delete in the request path. The resulting pending record remains observable so a future cleanup worker can reconcile stale database rows and orphaned objects safely.

## Remaining M3 work

- Browser upload flow with progress and retry handling.
- Asset Library UI with filtering, preview, metadata, and deletion.
- Thumbnail/preview generation pipeline for image/video/audio assets.
- Stale `PENDING` reconciliation and soft-delete storage cleanup job.
- End-to-end deployment verification against a real Vercel Blob store.
