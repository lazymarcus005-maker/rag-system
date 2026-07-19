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

