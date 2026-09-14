# Caddysoft Runtime Validation Gate

This document defines the authenticated Preview validation required before PR #1 is merged.

## Environment

- Validate only the `agent-stabilization-2026-09-14` branch and its Vercel Preview deployment.
- Production must not be promoted or modified during this gate.
- Clerk, database, and private Blob credentials remain in Vercel environment variables and are never committed.

## Required flow

1. Open the Preview deployment and authenticate with Clerk.
2. Verify authenticated application-user resolution.
3. Verify project ownership isolation.
4. Create, update, reorder, and archive scenes.
5. Verify optimistic concurrency rejects stale scene updates.
6. Verify character, location, and style references are user-scoped.
7. Create a generation from a scene and verify the immutable prompt/config snapshot.
8. Verify the generation is queued exactly once and the worker can claim a provider account atomically.
9. Verify provider submission and polling converge to one completed generation.
10. Verify duplicate completion/polling does not duplicate usage or output assets.
11. Verify the completed output appears in the project export manifest in deterministic scene order.
12. Verify unauthorized project/generation access is rejected.

## Merge gate

PR #1 is merge-eligible only after the above authenticated flow has been exercised successfully on Preview and the resulting runtime logs show no unexpected errors.
