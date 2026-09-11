# M5 Validation Gate

## Code gate

PASS for the implemented architecture:
- idempotent PostgreSQL job queue;
- row-claim concurrency protection;
- bounded retries and backoff;
- provider registry;
- opaque credential reference boundary;
- environment-backed secret resolver;
- Google Veo 3.1 adapter contract and implementation;
- atomic provider-account claim and usage counter;
- BUSY state retained while a provider operation is running;
- provider error classification;
- generation persistence and provider operation tracking;
- polling job loop;
- generation version persistence;
- usage-event foundation.

## Security gate

PASS by inspection:
- no provider secret is committed to source;
- credentialRef is opaque;
- secrets are resolved server-side;
- browser routes do not receive provider credentials;
- cron worker requires CRON_SECRET;
- generation/provider queries are user-scoped.

## Runtime gate

BLOCKED until a dedicated Caddysoft runtime environment exists. The repository currently has no GitHub Actions workflow, and no dedicated Caddysoft Vercel project has been established. Therefore a real build, database migration, provider request, polling round-trip, and output-asset upload cannot honestly be marked PASS from repository inspection alone.

Required runtime checks:
1. deploy Caddysoft to its own Vercel project;
2. configure Clerk and DATABASE_URL;
3. configure CRON_SECRET;
4. configure provider secret as CADDYSOFT_CREDENTIAL_<REF>;
5. create provider + provider account rows;
6. enqueue one generation;
7. verify submit → operation ID → polling → completion;
8. verify provider account READY/BUSY transitions and quota counter;
9. verify generation version + output asset;
10. inspect runtime logs for errors.

## Current verdict

M5 source architecture is READY FOR RUNTIME VALIDATION. M5 is not labeled runtime-PASS until the above environment checks are executed.

This gate does not authorize any deployment to Ana Farma production or /dev.
