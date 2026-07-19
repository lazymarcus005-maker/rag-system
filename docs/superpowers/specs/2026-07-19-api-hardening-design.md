# Design: API Hardening (8-Item Subset)

**Date:** 2026-07-19
**Scope:** Subset of `improvement.md` — 8 high-impact, low-risk hardening fixes for the NestJS API.
**Out of scope:** Token storage redesign, prompt sanitization, Swagger decorators, SSE status updates, E2E tests, metrics endpoint, README translation, architecture docs. These remain in `improvement.md` for future work.

## Goal

Make the API safer to run in production: fail fast on misconfiguration, drain gracefully on shutdown, survive transient DB/Ollama outages, bound list-response size, prevent model-dimension mismatch from silently corrupting the vector index, catch more type errors at compile time, and fix a known write-ordering race.

## Non-goals

- No new features, no new endpoints, no DB schema migrations.
- No frontend architectural changes (admin pages keep their current load-all UX; only the API response is bounded).
- No changes to the auth token storage model (deferred — item #1 in `improvement.md`).

## Items

### 1. Environment variable validation (#4)

**Problem:** `JWT_SECRET` silently defaults to `'dev-secret'`. Missing required env vars are not caught at startup.

**Change:**
- Add `joi` as a dependency.
- In `api/src/app.module.ts`, pass a Joi validation schema to `ConfigModule.forRoot({ validationSchema, validationOptions: { abortEarly: false } })`.
- Required in all environments: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `REDIS_HOST`, `OLLAMA_BASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- Required in production (`NODE_ENV=production`): `JWT_SECRET` with min length 16. In non-production, `JWT_SECRET` defaults to `'dev-secret'` but emits a warning.
- Optional with defaults: `DB_PORT` (5432), `REDIS_PORT` (6379), `API_PORT` (3001), `OLLAMA_CHAT_MODEL`, `OLLAMA_EMBED_MODEL`, `EMBEDDING_DIM` (1024), `UPLOAD_DIR` (`./uploads`), `RERANK_ENABLED` (`'true'`).

**Test:** Unit test that `AppModule` instantiation throws when `JWT_SECRET` is unset in production. (Use a dynamic-import approach with env mutated per test, or test the Joi schema directly.)

### 2. Graceful shutdown hooks (#5)

**Problem:** On SIGTERM, BullMQ workers may not drain active ingestion jobs; in-flight work is lost.

**Change:**
- In `api/src/main.ts`, call `app.enableShutdownHooks()` before `app.listen`.
- NestJS registers `SIGTERM`/`SIGINT` handlers that call `onModuleDestroy` on all providers. `AuthService.onModuleDestroy` already clears its sweep timer. BullMQ `WorkerHost` closes its worker on destroy.
- No new code beyond the one-liner. Verify with `docker compose stop api` and observe clean log lines.

**Test:** Config-only; verified via manual `docker compose stop` and build pass.

### 3. Database connection retry (#6)

**Problem:** If PostgreSQL is not ready when the API starts, TypeORM fails immediately and the container exits.

**Change:**
- In `api/src/app.module.ts`, in the `TypeOrmModule.forRootAsync` `useFactory`, add:
  - `retryAttempts: 5`
  - `retryDelay: 5000` (ms)
  - `keepConnectionAlive: true`
- No retry for BullMQ Redis (BullMQ already retries connections internally).

**Test:** Config-only; verified via build pass. Manual: start `api` before `postgres` and observe retries in logs instead of immediate crash.

### 4. Rate limit on chat endpoints (#7)

**Problem:** The chat stream endpoint allows 20 requests/min/user. A user can open many concurrent SSE streams, exhausting server resources.

**Change:**
- In `api/src/chat/chat.controller.ts`:
  - Tighten `@Throttle` on `stream` to `{ default: { limit: 6, ttl: 60_000 } }` (6 messages/min/user).
  - Add `@Throttle({ default: { limit: 20, ttl: 60_000 } })` on `create` (conversation creation) to prevent flooding.
- Other endpoints inherit the global default (120/min) which is fine.

**Test:** Add a spec that asserts the throttle metadata is applied (read decorator metadata) — or skip if too brittle. Prefer: rely on existing ThrottlerGuard behavior, verify via build + manual curl.

### 5. Bounded list responses (#9)

**Problem:** `DocumentsService.findAll()` and `UsersController.findAll()` return all rows. With many documents/users this is unbounded memory and bandwidth.

**Change:**
- Keep the response shape as an array (no breaking change for the frontend).
- Add optional `?limit` and `?offset` query params, defaulted to `limit=100, offset=0`. Cap `limit` at 100.
- `DocumentsService.findAll(limit, offset)` → `this.documents.find({ order: { createdAt: 'DESC' }, take: limit, skip: offset })`.
- `UsersController.findAll(limit, offset)` → `this.users.find({ select: [...], order: { createdAt: 'ASC' }, take: limit, skip: offset })`.
- `DocumentsController.findAll(@Query('limit') limit?: string, @Query('offset') offset?: string)` parses with `Number(...) || default`. Same for `UsersController.findAll`.
- Frontend (`web/app/admin/page.tsx`, `web/app/admin/users/page.tsx`) does not need changes — it still renders whatever array it receives. For typical deployments (<100 docs/users) behavior is unchanged.

**Test:** Unit test `findAll` calls repo with expected `take`/`skip`. Test cap at 100. Test default 100/0.

### 6. Runtime embedding-dimension validation (#11)

**Problem:** Migration hardcodes `vector(1024)` for bge-m3. If `OLLAMA_EMBED_MODEL` is changed to a model with a different dimension, embeddings silently fail at insert time (Postgres throws) or — worse — succeed with truncated/padded vectors if the column type is somehow coerced.

**Change:**
- Add `EMBEDDING_DIM` env var (default `1024`), validated by the Joi schema from item #1 as a positive integer.
- Add `OnModuleInit` to `OllamaService`:
  - Attempt `await this.embed(['dimension probe'])`.
  - If the call succeeds, compare `embeddings[0].length` to `EMBEDDING_DIM`. On mismatch, log `FATAL` and `throw new Error(...)` — app startup fails loudly.
  - If the call fails (Ollama unreachable), log `WARN` and continue. The `/health` endpoint already reports Ollama status; ingestion will fail individually with a clear error.
- No DB migration. The `vector(1024)` column type stays as-is; this guard prevents writing wrong-dim vectors.

**Test:** Unit test `OllamaService.onModuleInit`:
- Mock `embed` to return 768-dim vector while `EMBEDDING_DIM=1024` → throws.
- Mock `embed` to return 1024-dim → no throw.
- Mock `embed` to reject → no throw, warning logged.

### 7. TypeScript strict mode (#12)

**Problem:** API `tsconfig.json` only enables `strictNullChecks`. The web frontend uses full `strict`. Type errors that strict catches slip through.

**Change:**
- In `api/tsconfig.json`, replace `"strictNullChecks": true` with `"strict": true`.
- Run `npx tsc --noEmit` to enumerate errors. Fix each:
  - Likely: `ConfigService.get<T>()` returns `T | undefined` — provide defaults where used (most call sites already do).
  - Likely: `JSON.parse` in `retrieval.service.ts:126` returns `any` — add a typed cast.
  - Likely: `require('pdf-parse')` in `parser.service.ts` is untyped — wrap with `// eslint-disable` already present; cast return type.
  - Likely: `req: any` in controllers — leave as `any` (deliberate; NestJS guards populate `req.user`). Add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` if lint complains, but since there's no ESLint config (item #14, deferred), `any` is fine.
- Do not refactor unrelated code. Only fix what `strict` surfaces.

**Test:** Build pass (`npm run build`) with no TS errors. Existing jest tests pass.

### 8. Conversation title race condition (#15)

**Problem:** In `ChatService.streamAnswer`, the user message is saved (line 113-115) and then the conversation title is conditionally updated (line 116-118) as two separate DB operations. If the process crashes between them, the message is saved but the title remains `"New chat"`. More importantly, two concurrent requests on a new conversation could both try to update the title.

**Change:**
- Inject `DataSource` into `ChatService` (constructor param).
- Wrap the "save user message + update title" in `this.dataSource.transaction(async (manager) => { ... })`:
  - `await manager.save(Message, { conversationId, role: 'user', content })`
  - `if (convo.title === 'New chat') await manager.update(Conversation, convo.id, { title: content.slice(0, 80) })`
- The rest of the method (retrieval, streaming, assistant message save) stays outside the transaction to avoid holding a transaction open during long LLM streaming.
- The transaction is short (two writes) — no deadlock concern.

**Test:** Unit test that both writes happen in the same transaction (mock `DataSource.transaction` and assert both `manager.save` and `manager.update` are called inside the callback).

## Architecture

No new modules. One new dependency (`joi`). One new env var (`EMBEDDING_DIM`). Changes are localized to:

```
api/
  src/
    app.module.ts                    # Joi schema, TypeORM retry
    main.ts                           # enableShutdownHooks
    chat/
      chat.controller.ts              # tighter @Throttle, query params (n/a here)
      chat.service.ts                 # DataSource transaction for title
      chat.service.spec.ts            # new test for transaction
    documents/
      documents.controller.ts         # @Query limit/offset
      documents.service.ts            # findAll(limit, offset)
      documents.service.spec.ts       # new tests for pagination
    users/
      users.controller.ts             # @Query limit/offset
    llm/
      ollama.service.ts                # OnModuleInit dimension probe
      ollama.service.spec.ts          # new tests for probe
    retrieval/
      retrieval.service.ts            # type fix for JSON.parse (if strict surfaces it)
    ingestion/
      parser.service.ts               # type fix for require() (if strict surfaces it)
  tsconfig.json                       # strict: true
  package.json                         # +joi
```

Frontend unchanged.

## Error handling

- Env validation: `abortEarly: false` so all missing vars are reported at once. Joi throws `ConfigValidationError` → NestJS logs and exits.
- Embedding probe: failure to reach Ollama does NOT block startup (warn + continue). Dimension mismatch DOES block startup (fatal throw).
- DB retry: TypeORM logs each retry. After 5 attempts (25s total), startup fails with the underlying error.
- Title transaction: if the transaction fails, the whole `streamAnswer` call throws and the client receives an error SSE event (existing catch block handles it).

## Testing strategy

- **Unit (Jest):** Items #4 (env schema), #9 (pagination), #11 (dimension probe), #15 (transaction).
- **Build pass:** Items #2, #3, #7, #12 — verified via `npm run build` + `npm test`.
- **Manual (optional):** `docker compose up` then `docker compose stop api` to verify clean shutdown. Start api before postgres to verify DB retry.

## Rollout

Single PR. No DB migration → no coordinated deploy needed. New `EMBEDDING_DIM` env defaults to 1024 (current value) → existing deployments work without config change. Adding `joi` is a transitive-only risk (no API surface change).

## Risks

- **#12 strict mode** could surface many type errors. Mitigation: scope is "fix only what strict surfaces"; if the count is large, split into a separate PR and revisit with user. The design assumes a bounded fix.
- **#7 tighter throttle** could break legitimate power users who send >6 messages/min. Mitigation: 6/min is still substantial for a RAG chat; users who hit the limit get a 429 and can retry. Document the limit in the error response.
- **#5 shutdown hooks** change SIGTERM behavior. Mitigation: this is the standard NestJS pattern; Docker sends SIGTERM by default on `stop`. Verify the BullMQ worker finishes active jobs within the graceful period (Docker default 10s `stop_grace_period`).