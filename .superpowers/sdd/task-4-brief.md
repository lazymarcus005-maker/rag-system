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

