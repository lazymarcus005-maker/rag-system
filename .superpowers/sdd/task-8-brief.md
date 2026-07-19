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

