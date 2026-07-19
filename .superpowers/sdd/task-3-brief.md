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

