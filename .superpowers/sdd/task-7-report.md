# Task 7 Report: Conversation title-write transaction

## Status
**COMPLETE** — all checks pass.

## Summary
Wrapped the user-message save + conversation title update in `ChatService.streamAnswer` within a single `DataSource.transaction` to eliminate the write-ordering race. Retrieval, streaming, and the assistant-message save remain outside the transaction per the brief.

## TDD Evidence

### RED
After updating the spec (new `makeMocks` with `dataSource` mock, 5-arg constructor calls, new transaction test) but before touching `chat.service.ts`:

```
FAIL src/chat/chat.service.spec.ts
  ● Test suite failed to run
    src/chat/chat.service.spec.ts:84:7 - error TS2554: Expected 4 arguments, but got 5.
    src/chat/chat.service.spec.ts:116:7 - error TS2554: Expected 4 arguments, but got 5.
    src/chat/chat.service.spec.ts:141:7 - error TS2554: Expected 4 arguments, but got 5.
    src/chat/chat.service.spec.ts:161:7 - error TS2554: Expected 4 arguments, but got 5.
    src/chat/chat.service.spec.ts:181:7 - error TS2554: Expected 4 arguments, but got 5.

Test Suites: 1 failed, 1 total
Tests:       0 total
```

### GREEN
After adding `DataSource` import, 3rd constructor param, and replacing the two writes with `this.dataSource.transaction(async (manager) => { ... })`:

```
PASS src/chat/chat.service.spec.ts (16.864 s)
  ChatService
    √ rejects access to another user's conversation (6 ms)
    √ emits sources → tokens → done and persists assistant message (5 ms)
    √ short-circuits with a canned response when no sources found (2 ms)
    √ sends sanitized error message on failure and logs the real error (4 ms)
    √ saves the user message and updates the title in one transaction (3 ms)

Tests:       5 passed, 5 total
```

## Full Suite
```
Test Suites: 10 passed, 10 total
Tests:       58 passed, 58 total
```
(57 prior + 1 new = 58, matches expected count.)

## Build
```
> rag-api@0.1.0 build
> nest build
```
Clean — no TS errors, no warnings.

## Files Changed
- `api/src/chat/chat.service.ts`
  - Added `DataSource` to `typeorm` import.
  - Added `private readonly dataSource: DataSource` as 3rd constructor param (between `messages` and `retrieval`).
  - Replaced the two separate writes (message save + title update) with `this.dataSource.transaction(async (manager) => { manager.save(Message, ...); manager.update(Conversation, ...) })`.
- `api/src/chat/chat.service.spec.ts`
  - Added imports for `Conversation` and `Message` entities.
  - Replaced `makeMocks` to include `dataSource.transaction` mock (invokes callback with a `manager` carrying `save`/`update`). The `manager.save` mock populates `savedMessages` so existing assertions on `m.savedMessages` still pass.
  - Updated all 4 `new ChatService(...)` call sites to pass `m.dataSource as any` as the 3rd arg.
  - Added new test: `saves the user message and updates the title in one transaction` — asserts `dataSource.transaction` called once, `manager.save` called, and `manager.update(Conversation, 'c1', { title: 'first question'.slice(0, 80) })`.

## Commit
- SHA: `6314c952df65c078dce26dd904bcd42d924ba853`
- Subject: `fix(chat): save user message + title update in single transaction`
- Files: 2 changed, 53 insertions(+), 8 deletions(-)

## Note on `chat.module.ts`
The brief listed `chat.module.ts` under "Files: Modify" but did not specify any changes. `TypeOrmModule.forFeature([Conversation, Message])` (already present at `chat.module.ts:10`) makes `DataSource` injectable. The build passes, confirming DI works without module edits. No changes made.

## Self-Review Findings
- [x] `DataSource` imported and added as 3rd constructor param? — Yes (`chat.service.ts:4`, `:27`).
- [x] Transaction wraps both writes (message save + title update)? — Yes.
- [x] Retrieval/streaming/assistant-message-save remain OUTSIDE the transaction? — Yes (only the user-message save + title update are inside; retrieval `search`, `ollama.chatStream`, and the assistant `messages.save` remain on the main repo).
- [x] All 4 existing `new ChatService(...)` call sites updated? — Yes (lines 64-69, 96-101, 120-125, 139-144 in the new spec).
- [x] New test asserts `dataSource.transaction` called once + `manager.save` + `manager.update(Conversation, ...)`? — Yes.
- [x] 5 chat tests pass? Full suite passes? Build clean? — Yes (5/5 chat, 58/58 total, build clean).
- [x] No comments added? — None added to `chat.service.ts`. The spec's new test and mock code carry no comments either (the brief's sample `// DataSource.transaction...` and `// no sources → ...` comments were omitted per the "no comments" instruction).

## Concerns
None.