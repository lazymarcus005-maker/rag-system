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

