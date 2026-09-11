# M3 — Asset Engine

M3 provides the authenticated asset catalog and private binary storage lifecycle. It is the stable foundation for M4 media processing.

## Storage contract
- Asset metadata is user-scoped.
- Binary objects use server-generated storage keys.
- Browser uploads use short-lived, operation-scoped Vercel Blob signed URLs.
- Vercel Blob supports OIDC; the application no longer requires a long-lived Blob token merely to construct the storage adapter.
- Upload URLs can be constrained by MIME type and expected maximum byte size.
- Download URLs are short-lived and use cache-bypassing reads where immediate consistency matters.
- Browser clients never receive the storage credential.

## Asset lifecycle
`prepare-upload → PENDING → browser PUT → complete → READY → soft delete → asynchronous storage cleanup`

Cleanup:
- stale PENDING assets older than 24 hours are reconciled;
- deleted assets older than 7 days are eligible for binary deletion;
- successful deletion is recorded as `storageDeletedAt`;
- work is processed in bounded batches.

## M4 — Media Derivative Engine

A derivative is a materialized representation of a source asset used by the editor or generation pipeline. Source and derivative objects have independent storage keys and lifecycle state.

### Database
`asset_derivatives` contains:
- source `assetId`
- derivative `kind`
- `PENDING | READY | FAILED` status
- private storage key
- MIME
- size
- dimensions
- duration
- provider-neutral metadata
- soft-delete timestamp

The source + kind pair is unique for active derivative creation.

### Supported derivative kinds
- `THUMBNAIL` — image preview, generated as WebP.
- `POSTER` — representative video frame, generated as WebP.
- `WAVEFORM` — audio waveform visualization, generated as WebP.

### API
- `GET /api/assets/[assetId]/derivatives` — list derivatives for an owned source asset.
- `POST /api/assets/[assetId]/derivatives/prepare` — create/reuse a derivative record and return a scoped upload URL.
- `POST /api/assets/[assetId]/derivatives/[derivativeId]/complete` — verify the uploaded derivative in private Blob storage and mark it READY.

### Browser processing
The current M4 processor intentionally uses standard browser media primitives:
- `Image.decode()` + Canvas for image thumbnails;
- HTMLVideoElement + Canvas for video posters;
- Web Audio `decodeAudioData()` + Canvas for waveform images.

This keeps the application deployable without adding a heavyweight FFmpeg/Sharp runtime to the first production slice. The derivative contract remains provider-neutral, so a dedicated worker can replace or augment the browser processor later without changing the database/API contract.

### Processing flow
`source asset → signed GET → browser media decode → derivative render → prepare derivative upload → signed PUT → complete/verify → READY`

A failed render/upload does not expose storage credentials. The source asset remains unchanged.

## Production boundaries
- M3/M4 work is confined to `anafarma/Caddysoft`.
- No changes are made to Ana Farma production or `/dev`.
- Runtime verification requires a deployed Caddysoft project with its own database/auth/storage environment. Existing Ana Farma Vercel projects must not be used as a substitute.

## Remaining runtime work
1. Connect Caddysoft to its own Vercel project.
2. Connect private Blob storage to that project.
3. Configure the Caddysoft database and Clerk environment.
4. Apply migrations.
5. Run build/lint and browser verification.
6. Execute a real image/video/audio derivative round-trip.
7. Only after those checks pass, continue to M5 Generation/Provider orchestration.

These are environment-validation steps, not reasons to alter another project.