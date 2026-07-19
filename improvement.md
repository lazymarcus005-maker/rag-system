# Improvement Recommendations

## Security

### 1. Access token stored in localStorage (XSS risk)
**File:** `web/lib/api.ts`
The access token is stored in `localStorage`, making it vulnerable to XSS attacks. Consider storing it in an httpOnly cookie (like the refresh token) or using a BFF (Backend-for-Frontend) pattern with session-based auth.

### 2. No input sanitization on chat messages
**File:** `api/src/chat/chat.service.ts`
User chat input is passed directly to the LLM without sanitization, creating a prompt injection risk. Add input sanitization or use a prompt guard before forwarding to the LLM.

### 3. `.env` file may be committed
**File:** `api/.env`
The `.env` file contains a dev JWT secret and admin credentials. Verify it is not tracked by git. Consider using `.env.local` for local overrides and keeping `.env` as a template only.

### 4. Missing environment variable validation
**File:** `api/src/app.module.ts`
Missing `JWT_SECRET` silently defaults to `'dev-secret'`. Add startup validation for all required environment variables (e.g., using `joi` or `zod` with NestJS `ConfigModule.forRoot({ validationSchema })`).

---

## Production Hardening

### 5. No graceful shutdown hooks
**File:** `api/src/main.ts`
`app.enableShutdownHooks()` is not called. Without it, BullMQ workers won't drain their active jobs on SIGTERM, potentially losing in-flight ingestion work. Add `app.enableShutdownHooks()` before `app.listen()`.

### 6. No database connection retry logic
**File:** `api/src/app.module.ts`
If PostgreSQL is unavailable at startup, TypeORM fails immediately. Add retry logic in the TypeORM config (e.g., `retryAttempts: 5`, `retryDelay: 3000`) or use a `wait-for-it` script in the Docker entrypoint.

### 7. No rate limiting on chat stream endpoint
**File:** `api/src/chat/chat.controller.ts`
The SSE streaming endpoint has no rate limit. A malicious user could open many concurrent streams. Add `@Throttle()` or implement connection limits per user.

### 8. Missing Swagger/OpenAPI decorators
**Files:** `api/src/**/*.controller.ts`, `api/src/**/*.dto.ts`
Swagger is configured in `main.ts` but no controllers or DTOs have `@ApiTags`, `@ApiProperty`, or `@ApiOperation` decorators. The generated API docs will be minimal and unhelpful.

---

## Performance & Scalability

### 9. No pagination on list endpoints
**Files:** `api/src/documents/documents.service.ts`, `api/src/users/users.controller.ts`
`findAll()` returns all records without pagination. Add `skip`/`take` parameters and return paginated responses as the number of documents and users grows.

### 10. Polling for document ingestion status
**File:** `web/app/admin/page.tsx`
The admin page polls every 3 seconds via `setInterval`. Replace with SSE or WebSocket for real-time progress updates, reducing unnecessary network requests.

### 11. Hardcoded embedding dimension
**File:** `api/src/migrations/1700000000000-init-schema.ts`
The migration hardcodes `vector(1024)` for bge-m3. If the embedding model changes, all documents must be re-indexed. Add runtime validation that the Ollama model's embedding dimension matches the database column.

---

## Code Quality

### 12. No full TypeScript strict mode in API
**File:** `api/tsconfig.json`
Only `strictNullChecks` is enabled. Enable `strict: true` to catch more type errors at compile time (matches the web frontend which already uses strict mode).

### 13. Inconsistent import style for pdf-parse
**File:** `api/src/ingestion/parser.service.ts`
Uses `require('pdf-parse')` with an eslint-disable comment instead of an ES module import. This is a known limitation of the package but should be documented or wrapped in a typed adapter.

### 14. Missing ESLint configuration
No `.eslintrc` or `eslint.config.*` file found. The codebase has an `eslint-disable` comment suggesting ESLint was used at some point. Add a proper ESLint config to enforce consistent code style.

### 15. Conversation title update race condition
**File:** `api/src/chat/chat.service.ts:117`
The title is updated to the first message content outside a transaction with the message save. Wrap both operations in a database transaction to prevent inconsistency.

---

## Testing

### 16. No integration or E2E tests
All tests are unit tests with mocked dependencies. Add integration tests for the retrieval pipeline (real PostgreSQL + pgvector) and E2E tests for the chat flow (upload -> ingest -> query -> stream).

### 17. No test for the SSE streaming path
**File:** `api/src/chat/chat.service.spec.ts`
The streaming logic (SSE events, heartbeat, abort on disconnect) is tested but only with mocked Ollama responses. Add a test with a real or mock SSE server to verify the full streaming lifecycle.

---

## Observability

### 18. No structured logging context
**File:** `api/src/main.ts`
Pino is configured but request IDs or trace IDs are not propagated through the ingestion pipeline. Add `pino-http` request ID generation and pass it through BullMQ job data for end-to-end traceability.

### 19. No metrics/monitoring endpoint
Add a `/metrics` endpoint (e.g., Prometheus format) exposing queue depth, ingestion success/failure rates, retrieval latency, and LLM token usage.

---

## Documentation

### 20. README is Thai-only
**File:** `README.md`
The README is entirely in Thai. Consider adding an English version or bilingual sections for broader contributor accessibility.

### 21. No architecture documentation
Add an `ARCHITECTURE.md` or expand the README with a system diagram, data flow description, and explanation of the hybrid retrieval strategy (RRF + reranking).
