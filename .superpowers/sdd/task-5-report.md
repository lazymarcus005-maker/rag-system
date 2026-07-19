# Task 5 Report: Bounded list responses (documents + users)

## Status
COMPLETE

## Commit
- SHA: `188063899cb817025762211956020b6e85a06a84`
- Subject: `feat(api): bound list responses with limit/offset (cap 100)`

## Files Changed
- `api/src/documents/documents.service.ts` — `findAll(limit = 100, offset = 0)` with `Math.min(limit, 100)` and `Math.max(offset, 0)`, passes `take`/`skip` to `find()`.
- `api/src/documents/documents.controller.ts` — added `Query` import; `findAll` accepts `@Query('limit')` and `@Query('offset')` strings, coerces via `Number()` and forwards.
- `api/src/documents/documents.service.spec.ts` — `find` mock now accepts `opts?: any`; added 3 tests for default/cap/under-cap.
- `api/src/users/users.controller.ts` — added `Query` import; `findAll` computes `take`/`skip` inline (cap 100, floor 0) and passes to `this.users.find(...)`.

## TDD Evidence

### RED
Initial run after editing spec only (before service change):
```
FAIL src/documents/documents.service.spec.ts
  src/documents/documents.service.spec.ts:126:27 - error TS2554: Expected 0 arguments, but got 2.
  src/documents/documents.service.spec.ts:136:27 - error TS2554: Expected 0 arguments, but got 2.
Test Suites: 1 failed, 1 total
Tests:       0 total
```
TypeScript rejected the new `service.findAll(5000, 10)` calls because `findAll` accepted no args — confirms tests fail before implementation.

### GREEN
After updating `documents.service.ts`:
```
PASS src/documents/documents.service.spec.ts
  DocumentsService
    √ creates a document and enqueues ingestion
    √ rejects a file whose bytes do not match its extension
    √ rejects duplicate content and cleans up the upload
    √ remove() deletes the row and unlinks the file
    √ findAll applies limit and offset with defaults 100/0
    √ findAll caps limit at 100
    √ findAll honors a valid limit under 100
Tests: 7 passed, 7 total
```

### Full suite
```
npm test
Test Suites: 9 passed, 9 total
Tests:       53 passed, 53 total
```
(50 pre-existing + 3 new = 53, matches expectation.)

### Build
```
npm run build
> nest build
```
No output, exit 0 — clean compile.

## Self-Review
- [x] All 4 files updated per brief.
- [x] 3 new tests pass; full suite 53/53 passes.
- [x] `limit` capped at 100 via `Math.min`; `offset` floored at 0 via `Math.max`.
- [x] Frontend NOT modified (per design — renders whatever array it gets).
- [x] No comments added in code (brief included none).
- [x] Build clean (no TS errors, no warnings).
- [x] Thai strings in `documents.service.ts` (lines 32, 40) and `users.controller.ts` (lines 47, 57) preserved verbatim — those lines untouched.

## Concerns
None. Note: `Number()` on controller side does not validate NaN; if a client sends `?limit=abc` then `Number('abc')` yields `NaN`, and `Math.min(NaN, 100) === NaN`, which TypeORM would pass through. This is out of scope for the brief (brief explicitly uses `Number(limit)` without validation) but worth flagging for a future hardening pass.