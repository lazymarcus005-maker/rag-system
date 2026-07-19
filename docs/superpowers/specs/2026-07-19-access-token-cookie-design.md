# Design: Access Token in httpOnly Cookie

**Date:** 2026-07-19
**Scope:** Move the JWT access token from `localStorage` + `Authorization: Bearer` header into an httpOnly `access_token` cookie, hardening against XSS token theft.
**Out of scope:** CSRF tokens (deferred — `SameSite=Lax` is sufficient for our endpoint shape). BFF / session-based auth. Changes to the refresh-token flow (already httpOnly-cookie-based).

## Goal

Eliminate the XSS exposure of the access token by storing it where JavaScript cannot read it (httpOnly cookie), mirroring the existing refresh-token pattern. The frontend stops touching the access token entirely.

## Non-goals

- No changes to JWT signing, expiry, or the refresh-token rotation logic in `AuthService`.
- No changes to the refresh-token cookie (already httpOnly, `path: '/auth'`, `sameSite: 'lax'`).
- No CSRF token (deferred).
- No BFF / sessions rewrite.

## Architecture

```
Before:                                  After:
  login → JSON { accessToken, user }       login → JSON { user }
  ↓                                         ↓
  localStorage.token = accessToken          Set-Cookie: access_token (httpOnly)
  Authorization: Bearer <token>            Cookie: access_token=... (auto-sent)
```

The server's `JwtAuthGuard` reads the token from the `access_token` cookie (with backward-compat fallback to the `Authorization` header for Swagger / external API clients). The frontend's `authFetch` already uses `credentials: 'include'` on every request, so cookies flow to all endpoints including SSE.

## Server changes (`api/`)

### `auth.controller.ts`

In `respond(res, result)`:
- Add a second cookie: `access_token` = `result.accessToken`
  - `httpOnly: true`
  - `sameSite: 'lax'`
  - `secure: process.env.NODE_ENV === 'production'`
  - `path: '/'` (broader than refresh's `/auth` — needed for all API endpoints)
  - `maxAge: 15 * 60 * 1000` (15 minutes, matches JWT exp)
- Change the return body from `{ accessToken, user }` to `{ user }`.

In `logout`:
- Add `res.clearCookie('access_token', { path: '/' })` alongside the existing `clearCookie('refresh_token', { path: '/auth' })`.

### `jwt-auth.guard.ts`

Currently extracts Bearer token from `Authorization` header. Add cookie fallback:
1. Try `Authorization` header (backward compat for Swagger / external clients).
2. If no header, read `req.cookies?.access_token`.
3. If neither, throw `UnauthorizedException`.

### Constants

- `ACCESS_COOKIE = 'access_token'`
- `ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000`

## Frontend changes (`web/`)

### `lib/api.ts`

- `setSession(user)`: signature changes — no longer takes `accessToken`. Only stores `user` in localStorage.
- `getToken()`: remove. Replace all callers with `getUser()`.
- `clearSession()`: only clears `user` from localStorage (no more `token` to clear).
- `authFetch`: remove the `Authorization: Bearer` header logic. Already uses `credentials: 'include'`.
- `tryRefresh()`: no longer reads `data.accessToken`. Just checks `res.ok` and updates `user` from response body.
- `logout()`: unchanged (already calls `clearSession`).

### `app/login/page.tsx`

- `setSession(data.accessToken, data.user)` → `setSession(data.user)`.
- Type of `data` changes: `{ user }` instead of `{ accessToken, user }`.

### `app/admin/page.tsx`, `app/admin/users/page.tsx`, `app/chat/page.tsx`

- Replace `if (!getToken())` with `if (!getUser())` for auth-redirect checks.

## CSRF analysis

With `SameSite=Lax`:
- Cross-site requests with method POST/PATCH/DELETE → cookie NOT sent → no CSRF.
- Cross-site top-level GET navigations → cookie sent → but all our GET endpoints are read-only (`/documents`, `/users`, `/conversations`, `/conversations/:id/messages`). No data mutation via GET.
- Same-site requests → cookie sent → intended behavior.

Conclusion: `SameSite=Lax` is sufficient. A CSRF token is defense-in-depth and explicitly deferred.

## Testing

### New: `auth.controller.spec.ts`

Tests for `respond` behavior (login, register, refresh all funnel through `respond`):
- Sets `access_token` cookie with `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `maxAge: 900000`.
- In production, `secure: true`.
- Response body contains `user` but NOT `accessToken`.
- Logout clears the `access_token` cookie.

Mock `AuthService` (register/login/refresh/logout return fake `AuthResult`).

### New: `jwt-auth.guard.spec.ts`

- Reads token from `Authorization: Bearer <token>` header → verifies, attaches `req.user`.
- Falls back to `access_token` cookie when no header → verifies, attaches `req.user`.
- Throws `UnauthorizedException` when neither header nor cookie present.
- Throws when token is invalid / expired (delegates to `JwtService` — mock it).

Mock `JwtService.verify`, `Reflector`, `ExecutionContext`.

### Existing: `auth.service.spec.ts`

No changes. `AuthService` still returns `AuthResult { accessToken, refreshToken, user }` — the controller wraps it, not the service.

### Frontend

No test framework present in `web/`. Manual smoke test:
1. Login → verify `access_token` cookie set in browser DevTools, `localStorage.token` absent.
2. Navigate to `/chat` → conversations load (cookie auth).
3. Wait 16 min (or shorten JWT exp for testing) → next request 401 → silent refresh → succeeds.
4. Logout → `access_token` cookie cleared, redirect to `/login`.

## Migration / backward compatibility

- **API**: `JwtAuthGuard` keeps `Authorization` header support → Swagger UI, any existing API clients keep working unchanged.
- **Frontend**: atomic change — cookie set on login, read on subsequent requests, cleared on logout. No intermediate state where old frontend hits new API.
- **Deploy order**: API first (accepts both header and cookie), then frontend. Or together via `docker compose up -d --build api web`. Both safe.

## Risks

- **Swagger UI**: uses Bearer auth by default → still works (header support retained).
- **SSE**: frontend already uses `credentials: 'include'` on the chat stream → cookies flow. No change needed in `ChatController` or `ChatService`.
- **`path: '/'` on access cookie vs `path: '/auth'` on refresh cookie**: intentional — access token is needed on every API endpoint; refresh only on `/auth/refresh`.
- **15-min cookie expiry**: browser auto-removes the cookie at 15min. `authFetch` sees a 401 on the next request, calls `tryRefresh`, gets a fresh access cookie. Same flow as before, just cookie-based instead of header-based.
- **`req.cookies` requires `cookie-parser`**: already installed and registered in `main.ts` (`app.use(cookieParser())`). No new dep.

## Files

```
api/
  src/
    auth/
      auth.controller.ts          # set/clear access_token cookie, drop accessToken from body
      auth.controller.spec.ts     # NEW: cookie + body assertions
      jwt-auth.guard.ts            # cookie fallback
      jwt-auth.guard.spec.ts       # NEW: header + cookie + missing cases
web/
  lib/
    api.ts                         # remove getToken, setSession takes (user), drop Bearer header
  app/
    login/page.tsx                 # setSession(data.user)
    admin/page.tsx                 # !getUser() instead of !getToken()
    admin/users/page.tsx           # !getUser()
    chat/page.tsx                  # !getUser()
```