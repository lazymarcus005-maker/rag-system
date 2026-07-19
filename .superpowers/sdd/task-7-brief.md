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

