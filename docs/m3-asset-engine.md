# M3 — Asset Engine

## Scope

M3 establishes the authenticated asset catalog boundary. Assets belong to the signed-in application user and may optionally belong to one of that user's projects.

The engine intentionally separates **asset metadata/catalogue** from **binary storage**. `storageKey` identifies the eventual storage object; upload/signing is a later storage-provider layer and must not leak provider credentials to the browser.

## Current contract

### `GET /api/assets`

Returns active assets for the authenticated user, newest first.

Optional query parameters:
- `projectId` — restrict to one owned project.
- `kind` — `IMAGE | VIDEO | AUDIO | CHARACTER | LOCATION | LOGO | REFERENCE | OTHER`.

### `POST /api/assets`

Registers an asset after storage has been established. Required fields:
- `name`
- `kind`
- `storageKey`

Optional fields carry MIME type, byte size, duration, dimensions, project ownership, and provider-neutral metadata.

The project, when supplied, is ownership-checked against the authenticated user before insertion.

### `GET /api/assets/[assetId]`

Returns one active asset only when it belongs to the authenticated user.

### `DELETE /api/assets/[assetId]`

Soft-deletes an owned asset by setting `deletedAt`; binary cleanup is deliberately decoupled so storage lifecycle can be made provider-aware later.

## Security invariants

1. Every asset read is scoped by `userId`.
2. Project assignment is validated through the same user-scoped project lookup.
3. Deleted assets are excluded from normal catalog reads.
4. No storage credential is accepted by the asset API.
5. Asset metadata has bounded string fields and non-negative numeric validation.

## Next M3 layer

The next implementation step is the storage adapter boundary: a provider-neutral interface for create/upload URL, resolve/download URL, and delete operations. The UI should consume asset IDs and resolved URLs rather than provider-specific storage details.
