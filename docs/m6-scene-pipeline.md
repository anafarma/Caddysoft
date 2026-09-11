# M6 — Scene & Production Pipeline

M6 turns project scenes into validated, ordered generation inputs.

## Contract
A scene belongs to a user-owned project. Generation planning must verify:
- project exists and is ACTIVE;
- scene belongs to that project;
- scene is not ARCHIVED;
- a prompt or structured prompt exists;
- duration, when supplied, is within 1–3600 seconds.

The pipeline emits an immutable planning snapshot containing project, scene, prompt, structured prompt, duration and scene settings.

## Ordering
Scenes are returned by explicit position, with stable database ordering. The scene pipeline does not infer order from creation timestamps.

## Separation of concerns
- Scene data describes creative intent.
- Generation records describe an execution attempt.
- Generation versions preserve request/response snapshots.
- Assets hold binary outputs.
- Jobs provide durable asynchronous execution.

This prevents edits to a scene from mutating historical generation records.

## M6 next layers
1. Scene CRUD validation and optimistic concurrency.
2. Prompt compiler from structured scene data.
3. Character/location/style references.
4. Scene-to-generation batch planning.
5. Render timeline manifest.
6. Final project export manifest.
7. Resumable export jobs.
8. Final browser/E2E verification.

No production Ana Farma project is a deployment target.