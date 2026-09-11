# M5 — Generation & Provider Engine

M5 starts from the durable job boundary established after M4.

## Queue contract

Authenticated application code creates jobs through POST /api/jobs.

Every job has:
- user ownership;
- optional project/generation/provider-account references;
- type;
- idempotency key unique per user;
- bounded attempts;
- delayed availability;
- lock/start/finish timestamps;
- structured payload;
- error code/message.

The worker claims one eligible job using PostgreSQL row locking with FOR UPDATE SKIP LOCKED. This prevents two worker invocations from processing the same queue row concurrently.

## Retry policy

Transient failures return to RETRYING with exponential backoff capped at one hour. Attempts are bounded by maxAttempts. Unknown job types fail permanently.

## Worker boundary

GET /api/cron/jobs is a private scheduler boundary protected by CRON_SECRET. Provider network calls must only be introduced behind this worker boundary, never from public browser routes.

Current handlers intentionally fail with explicit NOT_CONFIGURED errors until provider orchestration is installed. This is safer than silently acknowledging a generation job without executing it.

## Provider architecture next

The next implementation layer is:
1. provider registry;
2. account eligibility selection;
3. cooldown/exhaustion transitions;
4. credential reference resolver;
5. provider adapter;
6. generation submission;
7. operation polling;
8. output asset registration;
9. usage/quota events;
10. generation version snapshots.

No provider credential should be stored in ordinary database fields. credentialRef remains an opaque pointer to the configured secret store.

## Boundary

All work remains inside Caddysoft. Ana Farma production and dev are not deployment targets.
