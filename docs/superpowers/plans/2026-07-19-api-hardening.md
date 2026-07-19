# API Hardening (8-Item Subset) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the NestJS API with 8 low-risk, high-impact fixes from `improvement.md`: env validation, graceful shutdown, DB retry, chat rate limits, bounded list responses, embedding-dimension probe, TypeScript strict mode, and a title-write transaction.

**Architecture:** Changes are localized to existing files in `api/src/`. One new dependency (`joi`). One new env var (`EMBEDDING_DIM`, default 1024). No DB migrations, no frontend changes, no new modules.

**Tech Stack:** NestJS 10, TypeScript 5.7, TypeORM 0.3, Jest 29, Joi 17 (to be added).

## Global Constraints

- Node 22, npm, Jest with ts-jest (config in `api/package.json`).
- Tests run from `api/` directory: `npm test` (runs jest against `src/**/*.spec.ts`).
- Build: `npm run build` from `api/` (runs `nest build` → `dist/`).
- The API is not currently a git repo at the workspace root; commit steps assume a git repo exists in `api/` or the workspace root. If `git status` fails, run `git init && git add -A && git commit -m "initial"` before starting, OR skip commit steps and let the user handle versioning.
- Follow existing test patterns: in-memory Maps for repos, jest.fn() for methods, no real DB. See `api/src/auth/auth.service.spec.ts` for the canonical pattern.
- Thai strings in error messages are intentional — preserve them verbatim.
- No comments added to code unless asked.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `api/package.json` | Modify | Add `joi` dependency |
| `api/src/app.module.ts` | Modify | Joi validation schema, TypeORM retry, `EMBEDDING_DIM` default |
| `api/src/main.ts` | Modify | `app.enableShutdownHooks()` |
| `api/tsconfig.json` | Modify | `strict: true` |
| `api/src/llm/ollama.service.ts` | Modify | `OnModuleInit` dimension probe |
| `api/src/llm/ollama.service.spec.ts` | Create | Tests for probe behavior |
| `api/src/chat/chat.controller.ts` | Modify | Tighter `@Throttle` on `stream`, add `@Throttle` on `create` |
| `api/src/chat/chat.service.ts` | Modify | Inject `DataSource`, transaction for title+message |
| `api/src/chat/chat.service.spec.ts` | Modify | New test for transaction; update existing test setup |
| `api/src/documents/documents.controller.ts` | Modify | `@Query` for limit/offset |
| `api/src/documents/documents.service.ts` | Modify | `findAll(limit, offset)` |
| `api/src/documents/documents.service.spec.ts` | Modify | Tests for pagination |
| `api/src/users/users.controller.ts` | Modify | `@Query` for limit/offset |
| `api/src/config/env.schema.ts` | Create | Joi schema (extracted for clarity + testability) |
| `api/src/config/env.schema.spec.ts` | Create | Test the schema directly |

---

## Task 1: Add joi dependency and create env schema

**Files:**
- Modify: `api/package.json`
- Create: `api/src/config/env.schema.ts`
- Create: `api/src/config/env.schema.spec.ts`

**Interfaces:**
- Produces: `envSchema` (a Joi object schema) exported from `api/src/config/env.schema.ts`, validated against `process.env`. Used by Task 2 to wire into `ConfigModule.forRoot`.

- [ ] **Step 1: Install joi**

Run from `api/`:
```bash
npm install joi@^17.13.3
```
Expected: `added 1 package` (or similar). `api/package.json` now lists `joi` under `dependencies`.

- [ ] **Step 2: Write the failing test for the schema**

Create `api/src/config/env.schema.spec.ts`:

```typescript
import * as Joi from 'joi';
import { envSchema } from './env.schema';

function validate(env: Record<string, string | undefined>) {
  const { error, value } = envSchema.validate(env, {
    abortEarly: false,
    stripUnknown: true,
  });
  return { error, value };
}

describe('envSchema', () => {
  const BASE = {
    NODE_ENV: 'production',
    DB_HOST: 'db',
    DB_USER: 'rag',
    DB_PASSWORD: 'secret',
    DB_NAME: 'rag',
    REDIS_HOST: 'redis',
    OLLAMA_BASE_URL: 'http://ollama:11434',
    ADMIN_EMAIL: 'admin@local',
    ADMIN_PASSWORD: 'adminpass1234',
    JWT_SECRET: 'a-very-long-production-secret-key',
  };

  it('accepts a complete production config', () => {
    const { error, value } = validate(BASE);
    expect(error).toBeUndefined();
    expect(value.EMBEDDING_DIM).toBe(1024);
  });

  it('requires JWT_SECRET in production', () => {
    const { error } = validate({ ...BASE, JWT_SECRET: undefined });
    expect(error).toBeDefined();
    expect(error!.message).toContain('JWT_SECRET');
  });

  it('requires JWT_SECRET to be at least 16 chars in production', () => {
    const { error } = validate({ ...BASE, JWT_SECRET: 'short' });
    expect(error).toBeDefined();
    expect(error!.message).toContain('JWT_SECRET');
  });

  it('does not require JWT_SECRET outside production', () => {
    const { error, value } = validate({ ...BASE, NODE_ENV: 'development', JWT_SECRET: undefined });
    expect(error).toBeUndefined();
    expect(value.JWT_SECRET).toBe('dev-secret');
  });

  it('requires DB_* and REDIS_HOST and OLLAMA_BASE_URL and ADMIN_*', () => {
    const { error } = validate({ ...BASE, DB_PASSWORD: undefined });
    expect(error).toBeDefined();
    expect(error!.message).toContain('DB_PASSWORD');
  });

  it('rejects non-positive EMBEDDING_DIM', () => {
    const { error } = validate({ ...BASE, EMBEDDING_DIM: '0' });
    expect(error).toBeDefined();
    expect(error!.message).toContain('EMBEDDING_DIM');
  });

  it('coerces EMBEDDING_DIM to a number', () => {
    const { value } = validate({ ...BASE, EMBEDDING_DIM: '768' });
    expect(value.EMBEDDING_DIM).toBe(768);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run from `api/`:
```bash
npx jest src/config/env.schema.spec.ts
```
Expected: FAIL — `Cannot find module './env.schema'` (module does not exist yet).

- [ ] **Step 4: Create the schema**

Create `api/src/config/env.schema.ts`:

```typescript
import * as Joi from 'joi';

export const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  API_PORT: Joi.number().default(3001),

  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_NAME: Joi.string().required(),

  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),

  OLLAMA_BASE_URL: Joi.string().required(),
  OLLAMA_API_KEY: Joi.string().optional(),
  OLLAMA_CHAT_MODEL: Joi.string().default('llama3.1:8b'),
  OLLAMA_EMBED_MODEL: Joi.string().default('bge-m3'),

  EMBEDDING_DIM: Joi.number().integer().positive().default(1024),

  JWT_SECRET: Joi.alternatives()
    .conditional('NODE_ENV', {
      is: 'production',
      then: Joi.string().min(16).required(),
      otherwise: Joi.string().default('dev-secret'),
    }),

  ADMIN_EMAIL: Joi.string().required(),
  ADMIN_PASSWORD: Joi.string().required(),

  UPLOAD_DIR: Joi.string().default('./uploads'),
  RERANK_ENABLED: Joi.string().valid('true', 'false').default('true'),
  ENABLE_DOCS: Joi.string().valid('true', 'false').optional(),
}).unknown(true);
```

- [ ] **Step 5: Run test to verify it passes**

Run from `api/`:
```bash
npx jest src/config/env.schema.spec.ts
```
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add api/package.json api/package-lock.json api/src/config/env.schema.ts api/src/config/env.schema.spec.ts
git commit -m "feat(config): add Joi env validation schema"
```

---

## Task 2: Wire env schema into AppModule + add DB retry

**Files:**
- Modify: `api/src/app.module.ts`

**Interfaces:**
- Consumes: `envSchema` from `api/src/config/env.schema.ts` (Task 1).
- Produces: `AppModule` that fails fast on invalid env, retries DB connection 5x.

- [ ] **Step 1: Read current file**

Read `api/src/app.module.ts` to confirm current shape (already shown above — 76 lines, `ConfigModule.forRoot({ isGlobal: true })` at line 24, TypeORM `useFactory` at lines 36-55).

- [ ] **Step 2: Modify app.module.ts — add validation + retry**

Edit `api/src/app.module.ts`:

Replace line 2 (`import { ConfigModule, ConfigService } from '@nestjs/config';`) — no change needed, already correct.

Add a new import after line 20 (`import { UsersModule } from './users/users.module';`):

```typescript
import { envSchema } from './config/env.schema';
```

Replace the `ConfigModule.forRoot({ isGlobal: true })` (line 24) with:

```typescript
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envSchema,
      validationOptions: { abortEarly: false, stripUnknown: true },
    }),
```

In the `TypeOrmModule.forRootAsync` `useFactory` (lines 38-54), add three fields to the returned object, after `migrationsRun: true,` (line 53):

```typescript
        retryAttempts: 5,
        retryDelay: 5000,
        keepConnectionAlive: true,
```

- [ ] **Step 3: Run full test suite to verify nothing broke**

Run from `api/`:
```bash
npm test
```
Expected: all existing tests PASS. New env-schema tests PASS. (Note: existing tests don't boot the full AppModule, so the validation schema isn't applied during unit tests — that's fine. Joi validation runs at module init, which only happens in integration/e2e.)

- [ ] **Step 4: Build to verify types**

Run from `api/`:
```bash
npm run build
```
Expected: compiles with no errors. `dist/main.js` exists.

- [ ] **Step 5: Commit**

```bash
git add api/src/app.module.ts
git commit -m "feat(config): wire Joi validation + TypeORM retry into AppModule"
```

---

## Task 3: Enable graceful shutdown hooks

**Files:**
- Modify: `api/src/main.ts`

**Interfaces:**
- Produces: API process that drains BullMQ workers on SIGTERM/SIGINT.

- [ ] **Step 1: Modify main.ts**

Edit `api/src/main.ts`. After line 13 (`app.useGlobalPipes(...)`) and before the `if (process.env.NODE_ENV ...)` block (line 15), add:

```typescript
  app.enableShutdownHooks();
```

The resulting function should look like:

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(cookieParser());
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableShutdownHooks();

  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DOCS === 'true') {
    // ... unchanged
  }

  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
  console.log(`API running on http://localhost:${port}`);
}
```

- [ ] **Step 2: Build to verify**

Run from `api/`:
```bash
npm run build
```
Expected: compiles. No new tests needed (config-only change).

- [ ] **Step 3: Run full test suite**

Run from `api/`:
```bash
npm test
```
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add api/src/main.ts
git commit -m "feat(lifecycle): enable graceful shutdown hooks"
```

---

## Task 4: Tighten chat rate limits

**Files:**
- Modify: `api/src/chat/chat.controller.ts`

**Interfaces:**
- Produces: `stream` endpoint throttled to 6/min/user, `create` endpoint throttled to 20/min/user.

- [ ] **Step 1: Modify chat.controller.ts**

Edit `api/src/chat/chat.controller.ts`. The `create` method is at lines 31-34, the `stream` method's `@Throttle` is at line 52.

Add `@Throttle` to `create` (before line 31):

```typescript
  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(@Req() req: any) {
    return this.chat.createConversation(req.user.sub);
  }
```

Change the `stream` `@Throttle` (line 52) from `{ default: { limit: 20, ttl: 60_000 } }` to:

```typescript
  @Post(':id/chat')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async stream(
```

- [ ] **Step 2: Build to verify**

Run from `api/`:
```bash
npm run build
```
Expected: compiles.

- [ ] **Step 3: Run tests**

Run from `api/`:
```bash
npm test
```
Expected: all PASS (no tests directly assert throttle decorators; ThrottlerGuard is a runtime concern).

- [ ] **Step 4: Commit**

```bash
git add api/src/chat/chat.controller.ts
git commit -m "feat(chat): tighten stream rate limit to 6/min, add 20/min on create"
```

---

## Task 5: Bounded list responses (documents + users)

**Files:**
- Modify: `api/src/documents/documents.controller.ts`
- Modify: `api/src/documents/documents.service.ts`
- Modify: `api/src/documents/documents.service.spec.ts`
- Modify: `api/src/users/users.controller.ts`

**Interfaces:**
- Produces: `DocumentsService.findAll(limit = 100, offset = 0)` and `UsersController.findAll(limit = 100, offset = 0)`. Both accept optional `?limit` and `?offset` query params; `limit` capped at 100.

- [ ] **Step 1: Write the failing test for DocumentsService.findAll pagination**

Edit `api/src/documents/documents.service.spec.ts`. The mock `documents.find` at line 31 currently is `jest.fn(async () => Array.from(store.values()))`. It needs to accept an options arg.

Replace line 31:

```typescript
    find: jest.fn(async (opts?: any) => Array.from(store.values())),
```

Add a new test inside the `describe('DocumentsService', ...)` block, after the last `it(...)` (after line 112):

```typescript
  it('findAll applies limit and offset with defaults 100/0', async () => {
    const { service, documents } = makeService();
    await service.findAll();
    expect(documents.find).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
      take: 100,
      skip: 0,
    });
  });

  it('findAll caps limit at 100', async () => {
    const { service, documents } = makeService();
    await service.findAll(5000, 10);
    expect(documents.find).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
      take: 100,
      skip: 10,
    });
  });

  it('findAll honors a valid limit under 100', async () => {
    const { service, documents } = makeService();
    await service.findAll(20, 40);
    expect(documents.find).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
      take: 20,
      skip: 40,
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run from `api/`:
```bash
npx jest src/documents/documents.service.spec.ts
```
Expected: FAIL — `findAll()` currently takes no args, so `documents.find` is called with `{ order: { createdAt: 'DESC' } }` (no `take`/`skip`). New tests expect `take: 100, skip: 0`.

- [ ] **Step 3: Modify DocumentsService.findAll**

Edit `api/src/documents/documents.service.ts`. Replace lines 59-61:

```typescript
  findAll() {
    return this.documents.find({ order: { createdAt: 'DESC' } });
  }
```

With:

```typescript
  findAll(limit = 100, offset = 0) {
    const take = Math.min(limit, 100);
    const skip = Math.max(offset, 0);
    return this.documents.find({ order: { createdAt: 'DESC' }, take, skip });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run from `api/`:
```bash
npx jest src/documents/documents.service.spec.ts
```
Expected: PASS (4 original + 3 new = 7 tests).

- [ ] **Step 5: Modify DocumentsController to pass query params**

Edit `api/src/documents/documents.controller.ts`. The `findAll` method is at lines 50-53.

Add `Query` to the imports from `@nestjs/common` (line 1-13). Current import list:
```typescript
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
```
Add `Query` after `Post`:

```typescript
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
```

Replace the `findAll` method (lines 50-53):

```typescript
  @Get()
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.documents.findAll(
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }
```

- [ ] **Step 6: Modify UsersController to pass query params**

Edit `api/src/users/users.controller.ts`. Add `Query` to the `@nestjs/common` import (lines 1-13). Insert `Query,` after `Patch`:

```typescript
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
```

Replace the `findAll` method (lines 32-38):

```typescript
  @Get()
  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    const take = Math.min(limit ? Number(limit) : 100, 100);
    const skip = Math.max(offset ? Number(offset) : 0, 0);
    return this.users.find({
      select: ['id', 'email', 'role', 'createdAt'],
      order: { createdAt: 'ASC' },
      take,
      skip,
    });
  }
```

- [ ] **Step 7: Build to verify**

Run from `api/`:
```bash
npm run build
```
Expected: compiles.

- [ ] **Step 8: Run full test suite**

Run from `api/`:
```bash
npm test
```
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add api/src/documents/documents.controller.ts api/src/documents/documents.service.ts api/src/documents/documents.service.spec.ts api/src/users/users.controller.ts
git commit -m "feat(api): bound list responses with limit/offset (cap 100)"
```

---

## Task 6: Embedding-dimension validation probe

**Files:**
- Modify: `api/src/llm/ollama.service.ts`
- Create: `api/src/llm/ollama.service.spec.ts`

**Interfaces:**
- Produces: `OllamaService` implements `OnModuleInit`. `onModuleInit()` probes `embed(['dimension check'])` and throws on dimension mismatch with `EMBEDDING_DIM`. Warns and continues if Ollama is unreachable.

- [ ] **Step 1: Write the failing test**

Create `api/src/llm/ollama.service.spec.ts`:

```typescript
import { ConfigService } from '@nestjs/config';
import { OllamaService } from './ollama.service';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    get: jest.fn((key: string, d?: unknown) =>
      overrides[key] !== undefined ? overrides[key] : d,
    ),
  } as unknown as ConfigService;
}

describe('OllamaService.onModuleInit', () => {
  it('throws when embedding dimension does not match EMBEDDING_DIM', async () => {
    const cfg = makeConfig({ EMBEDDING_DIM: 1024 });
    const svc = new OllamaService(cfg);
    jest.spyOn(svc, 'embed').mockResolvedValue([new Array(768).fill(0)]);
    await expect(svc.onModuleInit()).rejects.toThrow(/EMBEDDING_DIM.*1024.*768/);
  });

  it('does not throw when dimensions match', async () => {
    const cfg = makeConfig({ EMBEDDING_DIM: 1024 });
    const svc = new OllamaService(cfg);
    jest.spyOn(svc, 'embed').mockResolvedValue([new Array(1024).fill(0)]);
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
  });

  it('warns and continues when Ollama is unreachable (embed rejects)', async () => {
    const cfg = makeConfig({ EMBEDDING_DIM: 1024 });
    const svc = new OllamaService(cfg);
    jest.spyOn(svc, 'embed').mockRejectedValue(new Error('connection refused'));
    const warn = jest.spyOn((svc as any).logger, 'warn').mockImplementation(() => undefined);
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('defaults EMBEDDING_DIM to 1024 when not set', async () => {
    const cfg = makeConfig({});
    const svc = new OllamaService(cfg);
    jest.spyOn(svc, 'embed').mockResolvedValue([new Array(1024).fill(0)]);
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `api/`:
```bash
npx jest src/llm/ollama.service.spec.ts
```
Expected: FAIL — `OllamaService` does not implement `onModuleInit`, so `(svc as any).onModuleInit` is undefined → rejection or "not a function".

- [ ] **Step 3: Modify OllamaService**

Edit `api/src/llm/ollama.service.ts`.

Change the imports (line 1):

```typescript
import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
```

Add `implements OnModuleInit` and a logger to the class. Replace lines 9-21:

```typescript
@Injectable()
export class OllamaService implements OnModuleInit {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  readonly chatModel: string;
  readonly embedModel: string;
  private readonly embeddingDim: number;
  private readonly logger = new Logger(OllamaService.name);

  constructor(config: ConfigService) {
    this.baseUrl = config.get('OLLAMA_BASE_URL', 'http://localhost:11434');
    this.apiKey = config.get('OLLAMA_API_KEY');
    this.chatModel = config.get('OLLAMA_CHAT_MODEL', 'llama3.1:8b');
    this.embedModel = config.get('OLLAMA_EMBED_MODEL', 'bge-m3');
    this.embeddingDim = Number(config.get('EMBEDDING_DIM', 1024));
  }

  async onModuleInit() {
    try {
      const [probe] = await this.embed(['dimension check']);
      if (probe.length !== this.embeddingDim) {
        throw new Error(
          `Embedding dimension mismatch: Ollama model "${this.embedModel}" returned ${probe.length}-dim vectors but EMBEDDING_DIM=${this.embeddingDim}. Update EMBEDDING_DIM to match the model.`,
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Embedding dimension mismatch')) {
        throw err;
      }
      this.logger.warn(
        `Ollama unreachable during startup probe; skipping dimension validation: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
```

Leave `headers()`, `embed()`, `chat()`, `ping()`, `chatStream()` unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run from `api/`:
```bash
npx jest src/llm/ollama.service.spec.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Run full test suite**

Run from `api/`:
```bash
npm test
```
Expected: all PASS. (Existing tests don't instantiate OllamaService directly, but if they do via module init, the probe catches unreachable Ollama — the warn path returns cleanly. Verify no test boots the full AppModule.)

- [ ] **Step 6: Build**

Run from `api/`:
```bash
npm run build
```
Expected: compiles.

- [ ] **Step 7: Commit**

```bash
git add api/src/llm/ollama.service.ts api/src/llm/ollama.service.spec.ts
git commit -m "feat(llm): validate embedding dimension at startup"
```

---

## Task 7: Conversation title-write transaction

**Files:**
- Modify: `api/src/chat/chat.service.ts`
- Modify: `api/src/chat/chat.service.spec.ts`
- Modify: `api/src/chat/chat.module.ts`

**Interfaces:**
- Consumes: `DataSource` from TypeORM (already available via `TypeOrmModule.forFeature([Conversation, Message])` — need to add import).
- Produces: `ChatService` constructor takes `DataSource` as 5th param. `streamAnswer` wraps user-message-save + title-update in a single transaction.

- [ ] **Step 1: Write the failing test**

Edit `api/src/chat/chat.service.spec.ts`. The current `makeMocks` (lines 5-32) does not provide a `DataSource`. The `ChatService` constructor (line 63-68 etc.) takes 4 args. We need to add a `DataSource` mock that exposes `transaction(fn)` and calls `fn` with a `manager` that has `save` and `update`.

Replace the `makeMocks` function (lines 5-32) with:

```typescript
function makeMocks(convo: any) {
  const conversations = {
    save: jest.fn(async (c: any) => ({ id: 'c1', ...c })),
    create: jest.fn((c: any) => c),
    find: jest.fn(async () => [convo]),
    findOneBy: jest.fn(async (w: any) =>
      w.id === convo.id && w.userId === convo.userId ? convo : null,
    ),
    update: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
  };
  const savedMessages: any[] = [];
  const messages = {
    save: jest.fn(async (m: any) => {
      const saved = { id: `m${savedMessages.length + 1}`, ...m };
      savedMessages.push(saved);
      return saved;
    }),
    create: jest.fn((m: any) => m),
    find: jest.fn(async () => []),
  };
  const retrieval = { search: jest.fn(async () => []) };
  const ollama = {
    chat: jest.fn(async () => ''),
    chatStream: jest.fn(),
  };
  // DataSource.transaction(fn) invokes fn with a manager carrying save/update.
  const manager = {
    save: jest.fn(async (entity: any, data: any) => {
      if (entity === Message || (typeof entity === 'function' && entity.name === 'Message')) {
        const saved = { id: `m${savedMessages.length + 1}`, ...data };
        savedMessages.push(saved);
        return saved;
      }
      return data;
    }),
    update: jest.fn(async () => undefined),
  };
  const dataSource = {
    transaction: jest.fn(async (fn: (mgr: any) => Promise<unknown>) => fn(manager)),
  };
  return { conversations, messages, retrieval, ollama, savedMessages, dataSource, manager };
}
```

Add `import { Message } from '../entities/message.entity';` at the top of the spec file (after line 3):

```typescript
import { NotFoundException } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Message } from '../entities/message.entity';
import { ChatService } from './chat.service';
```

Now update every `new ChatService(...)` call to pass `m.dataSource as any` as the 5th arg. There are 4 such call sites: lines 63-68, 94-99, 118-123, 137-142. Each looks like:

```typescript
    const svc = new ChatService(
      m.conversations as any,
      m.messages as any,
      m.retrieval as any,
      m.ollama as any,
    );
```

Change each to:

```typescript
    const svc = new ChatService(
      m.conversations as any,
      m.messages as any,
      m.dataSource as any,
      m.retrieval as any,
      m.ollama as any,
    );
```

Add a new test at the end of the `describe` block (after line 151):

```typescript
  it('saves the user message and updates the title in one transaction', async () => {
    const m = makeMocks(convo);
    m.retrieval.search.mockResolvedValue([]); // no sources → no streaming, short-circuits
    const svc = new ChatService(
      m.conversations as any,
      m.messages as any,
      m.dataSource as any,
      m.retrieval as any,
      m.ollama as any,
    );
    const { res } = fakeResponse();
    await svc.streamAnswer('c1', 'u1', 'first question', res);

    expect(m.dataSource.transaction).toHaveBeenCalledTimes(1);
    // The manager's save should have been called for the user message.
    expect(m.manager.save).toHaveBeenCalled();
    // The title was 'New chat', so manager.update should have been called for Conversation.
    expect(m.manager.update).toHaveBeenCalledWith(
      Conversation,
      'c1',
      { title: 'first question'.slice(0, 80) },
    );
  });
```

Add `import { Conversation } from '../entities/conversation.entity';` at the top (after the Message import):

```typescript
import { NotFoundException } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Conversation } from '../entities/conversation.entity';
import { Message } from '../entities/message.entity';
import { ChatService } from './chat.service';
```

- [ ] **Step 2: Run test to verify it fails**

Run from `api/`:
```bash
npx jest src/chat/chat.service.spec.ts
```
Expected: FAIL — `ChatService` constructor takes 4 args; passing 5 should still work (extra ignored), but `streamAnswer` still uses `this.messages.save(...)` and `this.conversations.update(...)` directly (not a transaction). The new test asserts `dataSource.transaction` was called — currently `dataSource` isn't even a constructor param, so `this.dataSource.transaction` would throw at runtime.

- [ ] **Step 3: Modify ChatService to use DataSource + transaction**

Edit `api/src/chat/chat.service.ts`.

Add `DataSource` to the typeorm import (line 4):

```typescript
import { DataSource, Repository } from 'typeorm';
```

Add `DataSource` as 3rd constructor param (between `messages` and `retrieval`). Replace lines 23-29:

```typescript
  constructor(
    @InjectRepository(Conversation)
    private readonly conversations: Repository<Conversation>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    private readonly dataSource: DataSource,
    private readonly retrieval: RetrievalService,
    private readonly ollama: OllamaService,
  ) {}
```

In `streamAnswer`, replace lines 113-118 (the message save + title update):

```typescript
      await this.messages.save(
        this.messages.create({ conversationId, role: 'user', content }),
      );
      if (convo.title === 'New chat') {
        await this.conversations.update(convo.id, { title: content.slice(0, 80) });
      }
```

With:

```typescript
      await this.dataSource.transaction(async (manager) => {
        await manager.save(Message, { conversationId, role: 'user', content });
        if (convo.title === 'New chat') {
          await manager.update(Conversation, convo.id, {
            title: content.slice(0, 80),
          });
        }
      });
```

Leave everything else in `streamAnswer` unchanged (retrieval, streaming, assistant message save stay outside the transaction).

- [ ] **Step 4: Run test to verify it passes**

Run from `api/`:
```bash
npx jest src/chat/chat.service.spec.ts
```
Expected: PASS (4 original + 1 new = 5 tests). If existing tests fail because the mock `messages.save` is no longer called directly, that's expected — the new transaction path uses `manager.save(Message, ...)` instead. Adjust the existing test assertions that checked `m.messages.save` if any. (Looking at the spec, the existing tests check `m.savedMessages` which is populated by the mock `manager.save` in the new `makeMocks`, so they should still pass. Verify.)

- [ ] **Step 5: Run full test suite**

Run from `api/`:
```bash
npm test
```
Expected: all PASS.

- [ ] **Step 6: Build**

Run from `api/`:
```bash
npm run build
```
Expected: compiles.

- [ ] **Step 7: Commit**

```bash
git add api/src/chat/chat.service.ts api/src/chat/chat.service.spec.ts
git commit -m "fix(chat): save user message + title update in single transaction"
```

---

## Task 8: TypeScript strict mode

**Files:**
- Modify: `api/tsconfig.json`
- Possibly modify: any file that `tsc --strict` flags

**Interfaces:**
- Produces: `api/tsconfig.json` with `"strict": true`. All code compiles under strict.

- [ ] **Step 1: Enable strict mode**

Edit `api/tsconfig.json`. Replace line 16 (`"strictNullChecks": true,`) with:

```json
    "strict": true,
```

The full file becomes:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": false,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [ ] **Step 2: Enumerate type errors**

Run from `api/`:
```bash
npx tsc --noEmit
```
Expected: prints a list of type errors (possibly zero — `strictNullChecks` was already on, which is the biggest contributor). Common expected errors:
- `ConfigService.get(...)` returns `T | undefined` where used without a default → already mitigated by existing defaults.
- `JSON.parse(...)` in `retrieval.service.ts:129` returns `any` — under strict, `any` is allowed (strict doesn't ban `any`, `noImplicitAny` does, which is part of `strict`). This may surface if `match[0]` is typed as `any` from regex match — that's fine.
- `require('pdf-parse')` in `parser.service.ts:6` — `require` is typed via `@types/node`, returns `any`. Under `strict` this is allowed. Should not error.

If zero errors: proceed to Step 4.

- [ ] **Step 3: Fix each error (if any)**

For each error from Step 2:
- **If `ConfigService.get` returns `T | undefined`:** add a default arg or a non-null assertion only where the value is guaranteed (e.g., env already validated by Joi). Prefer adding defaults.
- **If `JSON.parse` result is used without a type:** wrap with a typed cast: `JSON.parse(match[0]) as number[]`.
- **If `req: any` triggers `noImplicitAny`:** the controllers use `req: any` explicitly — `noImplicitAny` only fires on *implicit* any, so explicit `any` is fine.
- **If other errors:** apply the minimal fix. Do not refactor unrelated code.

Do not add `// @ts-ignore` — fix the actual type. Do not add `// eslint-disable` comments (no ESLint config present).

- [ ] **Step 4: Build to verify**

Run from `api/`:
```bash
npm run build
```
Expected: compiles with no errors.

- [ ] **Step 5: Run full test suite**

Run from `api/`:
```bash
npm test
```
Expected: all PASS. If any test fails due to strict-mode type fixes, investigate — the fix may have changed runtime behavior. Revert the specific fix and apply a narrower one.

- [ ] **Step 6: Commit**

```bash
git add api/tsconfig.json api/src/
git commit -m "feat(typescript): enable strict mode and fix resulting type errors"
```

---

## Task 9: Final verification

**Files:** none modified.

- [ ] **Step 1: Clean build**

Run from `api/`:
```bash
npm run build
```
Expected: compiles. `dist/main.js`, `dist/app.module.js`, etc. exist.

- [ ] **Step 2: Full test suite**

Run from `api/`:
```bash
npm test
```
Expected: all PASS. Count should be: 9 auth + 4 chat + 7 documents + 6 file-validation + 5 ingestion + 3 parser + 5 chunker + 6 retrieval + 7 env-schema + 4 ollama + 1 new chat transaction = ~57 tests (verify the exact count by reading the test output; the new tests added by Tasks 1, 5, 6, 7 add to the baseline).

- [ ] **Step 3: Verify env validation runs at module init (manual smoke)**

If Docker is available:
```bash
docker compose up -d postgres redis ollama
cd api
NODE_ENV=production JWT_SECRET=short npx ts-node src/main.ts 2>&1 | head -20
```
Expected: process exits with a Joi validation error mentioning `JWT_SECRET`. (Ctrl-C if it hangs.)

If Docker is not available: skip this step — the unit tests in Task 1 cover the schema behavior.

- [ ] **Step 4: Verify graceful shutdown (manual, optional)**

If Docker is available:
```bash
docker compose up -d
docker compose stop api
docker compose logs api | tail -20
```
Expected: logs show BullMQ worker closing cleanly, no abrupt exit. The `onModuleDestroy` in `AuthService` fires (clears sweep timer).

- [ ] **Step 5: No commit (verification only)**

If all green, the implementation is complete. Inform the user.

---

## Self-Review Notes

- **Spec coverage:** All 8 items from the spec are covered: #4 (Task 1+2), #5 (Task 3), #6 (Task 2), #7 (Task 4), #9 (Task 5), #11 (Task 6), #12 (Task 8), #15 (Task 7). Task 9 is final verification.
- **Type consistency:** `OllamaService` constructor signature unchanged (still `ConfigService` only) — `OnModuleInit` is an interface add, no new constructor params. `ChatService` constructor gains `DataSource` as 3rd param — spec and test updated consistently. `DocumentsService.findAll(limit, offset)` matches controller call sites.
- **No placeholders:** Every step has actual code or commands.
- **Ordering:** Tasks 1-7 are independent (can be reordered). Task 8 (strict mode) is intentionally last so that type errors from earlier tasks (e.g., new `OnModuleInit`, new `DataSource` param) are already resolved before strict mode flags anything new. Task 9 verifies everything together.