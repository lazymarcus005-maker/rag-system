# Task 3 Report: Enable graceful shutdown hooks

## Status
Complete.

## Change
Added `app.enableShutdownHooks();` to `api/src/main.ts` after `app.useGlobalPipes(...)` (line 13) and before the `if (process.env.NODE_ENV ...)` block, per the brief. No other changes.

## Verification
- `npm test` from `api/`: 9 suites, 50/50 tests passed.
- `npm run build` from `api/`: compiles cleanly (nest build, no errors).

## Commit
- SHA: `61e4d8ba02a62da82830c75319aa4e9d1ee680a5`
- Subject: `feat(lifecycle): enable graceful shutdown hooks`
- Diff: 1 file changed, 1 insertion.

## Self-Review
- Placement: correct — after ValidationPipe, before Swagger if-block.
- No comments added; no other changes.
- Tests 50/50; build clean.

## Concerns
None.