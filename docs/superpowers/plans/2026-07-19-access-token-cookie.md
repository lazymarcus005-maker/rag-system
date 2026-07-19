# Access Token httpOnly Cookie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the JWT access token from `localStorage` + `Authorization: Bearer` header into an httpOnly `access_token` cookie, hardening against XSS token theft.

**Architecture:** Server sets an httpOnly `access_token` cookie alongside the existing `refresh_token` cookie on login/register/refresh. `JwtAuthGuard` reads the token from cookie (with backward-compat header fallback). Frontend stops touching the access token — `authFetch` already uses `credentials: 'include'`.

**Tech Stack:** NestJS 10, TypeScript 5.7 (strict), Jest 29, Next.js 14, cookie-parser (already installed).

## Global Constraints

- Node 22, npm, Jest with ts-jest (config in `api/package.json`).
- Tests run from `api/`: `npm test`. Build: `npm run build`.
- TypeScript `strict: true` is on (Task 8 of prior plan). New code must type-check under strict.
- Follow existing test patterns: in-memory Maps for repos, jest.fn() for methods, no real DB. See `api/src/auth/auth.service.spec.ts`.
- No comments in code unless the brief includes them.
- Thai strings preserved verbatim.
- No new npm dependencies (cookie-parser already installed and registered in `api/src/main.ts`).
- Frontend (`web/`) has no test framework — manual smoke test only.
- Repo root: `D:\Projects\Workspaces\@claude-code\@harness\rag-system` (git repo on `master`).

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `api/src/auth/auth.controller.ts` | Modify | Set/clear `access_token` cookie; drop `accessToken` from JSON body |
| `api/src/auth/auth.controller.spec.ts` | Create | Assert cookie attributes + body shape |
| `api/src/auth/jwt-auth.guard.ts` | Modify | Cookie fallback when no Authorization header |
| `api/src/auth/jwt-auth.guard.spec.ts` | Create | Header + cookie + missing-token cases |
| `web/lib/api.ts` | Modify | Remove `getToken`; `setSession(user)`; drop Bearer header |
| `web/app/login/page.tsx` | Modify | `setSession(data.user)` |
| `web/app/admin/page.tsx` | Modify | `!getUser()` instead of `!getToken()` |
| `web/app/admin/users/page.tsx` | Modify | `!getUser()` |
| `web/app/chat/page.tsx` | Modify | `!getUser()` |

---

## Task 1: Set access_token cookie in AuthController (TDD)

**Files:**
- Modify: `api/src/auth/auth.controller.ts`
- Create: `api/src/auth/auth.controller.spec.ts`

**Interfaces:**
- Produces: `AuthController.respond()` sets an httpOnly `access_token` cookie (path `/`, maxAge 900000, sameSite lax, secure in prod) and returns `{ user }` (no `accessToken` in body). `logout` clears the cookie.

- [ ] **Step 1: Read current files**

Read `api/src/auth/auth.controller.ts` and `api/src/auth/auth.service.ts` (to understand `AuthResult` shape). The controller's `respond` method is at lines 52-61 of `auth.controller.ts`. The `AuthResult` type is `{ accessToken: string; refreshToken: string; user: { id; email; role } }`.

- [ ] **Step 2: Write the failing test**

Create `api/src/auth/auth.controller.spec.ts`:

```typescript
import { ExecutionContext } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

function makeRes() {
  const cookies: Record<string, { value: string; opts: any }> = {};
  const cleared: string[] = [];
  const res: any = {
    cookie: jest.fn((name: string, value: string, opts: any) => {
      cookies[name] = { value, opts };
    }),
    clearCookie: jest.fn((name: string, opts: any) => {
      cleared.push(name);
    }),
  };
  return { res, cookies, cleared };
}

function makeService(overrides: Partial<AuthService> = {}) {
  return {
    register: jest.fn(async () => ({
      accessToken: 'access.jwt',
      refreshToken: 'refresh.jwt',
      user: { id: 'u1', email: 'a@b.co', role: 'user' },
    })),
    login: jest.fn(async () => ({
      accessToken: 'access.jwt',
      refreshToken: 'refresh.jwt',
      user: { id: 'u1', email: 'a@b.co', role: 'user' },
    })),
    refresh: jest.fn(async () => ({
      accessToken: 'access.jwt.new',
      refreshToken: 'refresh.jwt.new',
      user: { id: 'u1', email: 'a@b.co', role: 'user' },
    })),
    logout: jest.fn(async () => ({ ok: true })),
    ...overrides,
  } as unknown as AuthService;
}

describe('AuthController', () => {
  describe('login (respond)', () => {
    it('sets access_token cookie with httpOnly, sameSite=lax, path=/, maxAge=900000', async () => {
      const service = makeService();
      const ctrl = new AuthController(service);
      const { res, cookies } = makeRes();
      await ctrl.login({ email: 'a@b.co', password: 'password1' }, res);
      expect(cookies.access_token).toBeDefined();
      expect(cookies.access_token.value).toBe('access.jwt');
      expect(cookies.access_token.opts).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 900000,
      });
    });

    it('sets refresh_token cookie with path=/auth', async () => {
      const service = makeService();
      const ctrl = new AuthController(service);
      const { res, cookies } = makeRes();
      await ctrl.login({ email: 'a@b.co', password: 'password1' }, res);
      expect(cookies.refresh_token).toBeDefined();
      expect(cookies.refresh_token.opts).toMatchObject({
        httpOnly: true,
        path: '/auth',
      });
    });

    it('returns body without accessToken', async () => {
      const service = makeService();
      const ctrl = new AuthController(service);
      const { res } = makeRes();
      const body = await ctrl.login({ email: 'a@b.co', password: 'password1' }, res);
      expect(body).not.toHaveProperty('accessToken');
      expect(body).toMatchObject({ user: { email: 'a@b.co', role: 'user' } });
    });

    it('sets secure=true in production', async () => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const service = makeService();
      const ctrl = new AuthController(service);
      const { res, cookies } = makeRes();
      await ctrl.login({ email: 'a@b.co', password: 'password1' }, res);
      expect(cookies.access_token.opts.secure).toBe(true);
      process.env.NODE_ENV = prev;
    });
  });

  describe('register', () => {
    it('sets access_token cookie and returns body without accessToken', async () => {
      const service = makeService();
      const ctrl = new AuthController(service);
      const { res, cookies } = makeRes();
      const body = await ctrl.register({ email: 'a@b.co', password: 'password1' }, res);
      expect(cookies.access_token).toBeDefined();
      expect(body).not.toHaveProperty('accessToken');
    });
  });

  describe('refresh', () => {
    it('sets a new access_token cookie and returns body without accessToken', async () => {
      const service = makeService();
      const ctrl = new AuthController(service);
      const req: any = { cookies: { refresh_token: 'refresh.jwt' } };
      const { res, cookies } = makeRes();
      const body = await ctrl.refresh(req, res);
      expect(cookies.access_token.value).toBe('access.jwt.new');
      expect(body).not.toHaveProperty('accessToken');
    });
  });

  describe('logout', () => {
    it('clears both access_token and refresh_token cookies', async () => {
      const service = makeService();
      const ctrl = new AuthController(service);
      const req: any = { cookies: { refresh_token: 'refresh.jwt' } };
      const { res, cleared } = makeRes();
      await ctrl.logout(req, res);
      expect(cleared).toEqual(expect.arrayContaining(['access_token', 'refresh_token']));
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run from `api/`:
```bash
npx jest src/auth/auth.controller.spec.ts
```
Expected: FAIL — current `respond` returns `{ accessToken, user }` (body has `accessToken`), and doesn't set an `access_token` cookie. Multiple test assertions fail.

- [ ] **Step 4: Modify auth.controller.ts**

Edit `api/src/auth/auth.controller.ts`.

Add constants after line 8 (`REFRESH_COOKIE_MAX_AGE`):

```typescript
const ACCESS_COOKIE = 'access_token';
const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000;
```

Replace the `respond` method (lines 52-61):

```typescript
  private respond(res: Response, result: AuthResult) {
    res.cookie(ACCESS_COOKIE, result.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ACCESS_COOKIE_MAX_AGE,
    });
    res.cookie(REFRESH_COOKIE, result.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/auth',
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });
    return { user: result.user };
  }
```

Replace the `logout` method (lines 45-50):

```typescript
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(ACCESS_COOKIE, { path: '/' });
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
    return result;
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run from `api/`:
```bash
npx jest src/auth/auth.controller.spec.ts
```
Expected: PASS (7 tests).

- [ ] **Step 6: Run full suite + build**

Run from `api/`:
```bash
npm test
npm run build
```
Expected: all tests pass (68 prior + 7 new = 75). Build clean.

- [ ] **Step 7: Commit**

```bash
git add api/src/auth/auth.controller.ts api/src/auth/auth.controller.spec.ts
git commit -m "feat(auth): set access_token in httpOnly cookie, drop from response body"
```

---

## Task 2: JwtAuthGuard reads from cookie as fallback (TDD)

**Files:**
- Modify: `api/src/auth/jwt-auth.guard.ts`
- Create: `api/src/auth/jwt-auth.guard.spec.ts`

**Interfaces:**
- Produces: `JwtAuthGuard` extracts token from `Authorization: Bearer <token>` header first; if absent, reads `req.cookies.access_token`. Throws `UnauthorizedException` if neither present.

- [ ] **Step 1: Read current guard**

Read `api/src/auth/jwt-auth.guard.ts`. The guard currently extracts the Bearer token from the `Authorization` header and calls `jwtService.verify`. Note its constructor shape (likely `JwtService` + `Reflector`).

- [ ] **Step 2: Write the failing test**

Create `api/src/auth/jwt-auth.guard.spec.ts`:

```typescript
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeContext(req: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function makeGuard(verifyResult: unknown = { sub: 'u1', email: 'a@b.co', role: 'user' }) {
  const jwt = { verify: jest.fn(() => verifyResult) };
  const reflector = { getAllAndOverride: jest.fn(() => false) };
  const guard = new JwtAuthGuard(jwt as any, reflector as any);
  return { guard, jwt, reflector };
}

describe('JwtAuthGuard', () => {
  it('reads token from Authorization header', async () => {
    const { guard, jwt } = makeGuard();
    const req = { headers: { authorization: 'Bearer header.jwt.token' }, cookies: {} };
    const result = await guard.canActivate(makeContext(req));
    expect(result).toBe(true);
    expect(jwt.verify).toHaveBeenCalledWith('header.jwt.token');
    expect((req as any).user).toMatchObject({ sub: 'u1' });
  });

  it('falls back to access_token cookie when no header', async () => {
    const { guard, jwt } = makeGuard();
    const req = { headers: {}, cookies: { access_token: 'cookie.jwt.token' } };
    const result = await guard.canActivate(makeContext(req));
    expect(result).toBe(true);
    expect(jwt.verify).toHaveBeenCalledWith('cookie.jwt.token');
  });

  it('prefers header when both present', async () => {
    const { guard, jwt } = makeGuard();
    const req = {
      headers: { authorization: 'Bearer header.jwt' },
      cookies: { access_token: 'cookie.jwt' },
    };
    await guard.canActivate(makeContext(req));
    expect(jwt.verify).toHaveBeenCalledWith('header.jwt');
  });

  it('throws UnauthorizedException when neither header nor cookie', async () => {
    const { guard } = makeGuard();
    const req = { headers: {}, cookies: {} };
    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when verify throws', async () => {
    const jwt = { verify: jest.fn(() => { throw new Error('jwt malformed'); }) };
    const reflector = { getAllAndOverride: jest.fn(() => false) };
    const guard = new JwtAuthGuard(jwt as any, reflector as any);
    const req = { headers: { authorization: 'Bearer bad' }, cookies: {} };
    await expect(guard.canActivate(makeContext(req))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run from `api/`:
```bash
npx jest src/auth/jwt-auth.guard.spec.ts
```
Expected: the "falls back to access_token cookie" test FAILS (current guard only reads the header); the "throws when neither" test may pass if current guard already throws on missing header. At least one RED test.

- [ ] **Step 4: Modify jwt-auth.guard.ts**

Read the current guard. It likely has a method like:

```typescript
const authHeader = request.headers.authorization;
if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedException();
const token = authHeader.slice(7);
```

Replace the extraction logic with a fallback chain. The exact code depends on the current file's structure — apply this pattern:

```typescript
const authHeader = request.headers.authorization;
let token: string | undefined;
if (authHeader?.startsWith('Bearer ')) {
  token = authHeader.slice(7);
} else if (request.cookies?.access_token) {
  token = request.cookies.access_token;
}
if (!token) throw new UnauthorizedException();
```

Leave the rest of the guard (verify call, `req.user` assignment, `super.canActivate` for optional roles) unchanged. Preserve the exact variable names and error messages the guard already uses — only change the token-extraction portion.

- [ ] **Step 5: Run test to verify it passes**

Run from `api/`:
```bash
npx jest src/auth/jwt-auth.guard.spec.ts
```
Expected: PASS (5 tests).

- [ ] **Step 6: Run full suite + build**

Run from `api/`:
```bash
npm test
npm run build
```
Expected: all pass (75 + 5 = 80). Build clean.

- [ ] **Step 7: Commit**

```bash
git add api/src/auth/jwt-auth.guard.ts api/src/auth/jwt-auth.guard.spec.ts
git commit -m "feat(auth): JwtAuthGuard reads access_token from cookie as fallback"
```

---

## Task 3: Frontend — stop touching the access token

**Files:**
- Modify: `web/lib/api.ts`
- Modify: `web/app/login/page.tsx`
- Modify: `web/app/admin/page.tsx`
- Modify: `web/app/admin/users/page.tsx`
- Modify: `web/app/chat/page.tsx`

**Interfaces:**
- Produces: `setSession(user)` (one arg). `getToken` removed. `authFetch` no longer sets `Authorization` header. All `!getToken()` checks replaced with `!getUser()`.

- [ ] **Step 1: Read current files**

Read `web/lib/api.ts`, `web/app/login/page.tsx`, `web/app/admin/page.tsx`, `web/app/admin/users/page.tsx`, `web/app/chat/page.tsx`. Note every call site of `getToken` and `setSession`.

- [ ] **Step 2: Modify `web/lib/api.ts`**

Replace the `getToken` function (lines 3-6) — delete it entirely.

Replace `setSession` (lines 14-17):

```typescript
export function setSession(user: unknown) {
  localStorage.setItem('user', JSON.stringify(user));
}
```

Replace `clearSession` (lines 19-22):

```typescript
export function clearSession() {
  localStorage.removeItem('user');
}
```

Replace `tryRefresh` (lines 24-37):

```typescript
async function tryRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.user) setSession(data.user);
    return true;
  } catch {
    return false;
  }
}
```

Replace `authFetch` (lines 40-61) — remove the `Authorization` header logic:

```typescript
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const doFetch = () => {
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  };

  let res = await doFetch();
  if (res.status === 401 && (await tryRefresh())) {
    res = await doFetch();
  }
  if (res.status === 401 && typeof window !== 'undefined') {
    clearSession();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  return res;
}
```

`logout` (lines 72-79) — unchanged.

- [ ] **Step 3: Modify `web/app/login/page.tsx`**

Change the import (line 5):

```typescript
import { api, setSession } from '@/lib/api';
```
(unchanged — `setSession` still imported)

Change the submit handler (line 24):

```typescript
      const data = await api<{ user: { role: string } }>(
        `/auth/${mode}`,
        { method: 'POST', body: JSON.stringify({ email, password }) },
      );
      setSession(data.user);
      router.push(data.user.role === 'admin' ? '/admin' : '/chat');
```

(The `accessToken` is removed from the type since the API no longer returns it.)

- [ ] **Step 4: Modify `web/app/admin/page.tsx`**

Change the import (line 5):

```typescript
import { api, getUser } from '@/lib/api';
```

Replace `if (!getToken() || getUser()?.role !== 'admin')` (line 37) with:

```typescript
    if (getUser()?.role !== 'admin') {
```

- [ ] **Step 5: Modify `web/app/admin/users/page.tsx`**

Change the import (line 5):

```typescript
import { api, getUser } from '@/lib/api';
```

Replace `if (!getToken() || getUser()?.role !== 'admin')` (line 25) with:

```typescript
    if (getUser()?.role !== 'admin') {
```

- [ ] **Step 6: Modify `web/app/chat/page.tsx`**

Read the file to find the `getToken` import and usage. Replace the import to drop `getToken`, and replace `if (!getToken())` (or similar) with `if (!getUser())`. If the chat page uses `getToken` for anything beyond an auth-redirect check, flag it as a concern — the design says all such checks use `getUser()`.

- [ ] **Step 7: Build the frontend**

Run from `web/`:
```bash
npm run build
```
Expected: compiles. No TypeScript errors (web uses strict mode too). If `getToken` is referenced anywhere else, the build fails with "getToken is not exported" — fix the remaining call site.

- [ ] **Step 8: Commit**

```bash
git add web/lib/api.ts web/app/login/page.tsx web/app/admin/page.tsx web/app/admin/users/page.tsx web/app/chat/page.tsx
git commit -m "feat(web): move access token to httpOnly cookie, drop localStorage token"
```

---

## Task 4: Final verification

**Files:** none modified.

- [ ] **Step 1: API build + tests**

Run from `api/`:
```bash
npm run build
npm test
```
Expected: build clean, 80 tests pass (10 suites prior + 2 new = 12 suites).

- [ ] **Step 2: Web build**

Run from `web/`:
```bash
npm run build
```
Expected: compiles. No references to `getToken`.

- [ ] **Step 3: Grep for leftover getToken references**

Run from repo root:
```bash
grep -r "getToken" web/ --include="*.ts" --include="*.tsx"
```
Expected: no matches (or only matches in `node_modules` / `.next` build cache which are gitignored).

- [ ] **Step 4: Manual smoke test (optional, if Docker available)**

```bash
docker compose up -d
```
1. Open `http://localhost:3000/login`, log in.
2. Browser DevTools → Application → Cookies → verify `access_token` (httpOnly) and `refresh_token` (httpOnly) are set; Application → Local Storage → verify NO `token` key (only `user`).
3. Navigate to `/chat` — conversations load.
4. Navigate to `/admin` (as admin user) — documents load.
5. Click logout — both cookies cleared, redirected to `/login`.

- [ ] **Step 5: No commit (verification only)**

If all green, implementation is complete. Inform the user.

---

## Self-Review Notes

- **Spec coverage:** All spec sections covered: server cookie set/clear (Task 1), guard cookie fallback (Task 2), frontend cleanup (Task 3), verification (Task 4).
- **Type consistency:** `setSession(user: unknown)` matches call sites `setSession(data.user)` where `data.user` is `{ id, email, role }` from the API. `AuthResult` unchanged in service layer.
- **No placeholders:** Every step has actual code or commands.
- **Ordering:** Task 1 (API cookie) and Task 2 (guard) are independent but must both land before Task 3 (frontend) — the frontend relies on the API sending the cookie. Task 3 last. Task 4 verifies.
- **Backward compat:** Guard keeps `Authorization: Bearer` header support (Task 2 step 4 — header tried first). Swagger UI and any external API clients keep working.