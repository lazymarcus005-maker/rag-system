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

