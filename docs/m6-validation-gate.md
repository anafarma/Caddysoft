# M6 Validation Gate — Scene & Production Pipeline

## Source gate

Implemented on `agent-stabilization-2026-09-14`:
- authenticated project-scene listing;
- scene creation with bounded title/prompt/duration validation;
- optimistic scene updates using `updatedAt`;
- archive semantics instead of destructive scene deletion;
- deterministic position ordering with stable ID tie-breaker;
- generation validation for active, prompt-bearing scenes;
- immutable scene generation snapshots;
- user-scoped character, location and style references;
- deterministic prompt compilation from structured scene data;
- project-level generation planning;
- project render timeline manifest using the latest completed generation output per scene.

## API surface

- `GET /api/projects/:projectId/scenes`
- `POST /api/projects/:projectId/scenes`
- `PATCH /api/projects/:projectId/scenes/:sceneId`
- `DELETE /api/projects/:projectId/scenes/:sceneId`
- `POST /api/projects/:projectId/scenes/plan`
- `GET /api/projects/:projectId/export-manifest`

## Runtime gate

Still required before M6 can be marked runtime-PASS:
1. dedicated Caddysoft runtime with Clerk, database and private Blob storage;
2. migration application against the dedicated database;
3. authenticated scene CRUD round-trip;
4. concurrent optimistic-update conflict test;
5. scene reference ownership test;
6. generation-plan snapshot test after scene edits;
7. completed-generation render-manifest test;
8. browser/E2E verification;
9. runtime error/log review.

No Ana Farma production project or `/dev` environment is a deployment target.
