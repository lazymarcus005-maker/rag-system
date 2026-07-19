## Commits
6314c95 fix(chat): save user message + title update in single transaction

## Stat
 api/src/chat/chat.service.spec.ts | 44 ++++++++++++++++++++++++++++++++++++++-
 api/src/chat/chat.service.ts      | 17 ++++++++-------
 2 files changed, 53 insertions(+), 8 deletions(-)

## Diff
diff --git a/api/src/chat/chat.service.spec.ts b/api/src/chat/chat.service.spec.ts
index 1a36209..ae18aaa 100644
--- a/api/src/chat/chat.service.spec.ts
+++ b/api/src/chat/chat.service.spec.ts
@@ -1,12 +1,14 @@
 import { NotFoundException } from '@nestjs/common';
 import { EventEmitter } from 'events';
+import { Conversation } from '../entities/conversation.entity';
+import { Message } from '../entities/message.entity';
 import { ChatService } from './chat.service';
 
 function makeMocks(convo: any) {
   const conversations = {
     save: jest.fn(async (c: any) => ({ id: 'c1', ...c })),
     create: jest.fn((c: any) => c),
     find: jest.fn(async () => [convo]),
     findOneBy: jest.fn(async (w: any) =>
       w.id === convo.id && w.userId === convo.userId ? convo : null,
     ),
@@ -21,21 +23,35 @@ function makeMocks(convo: any) {
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
-  return { conversations, messages, retrieval, ollama, savedMessages };
+  const manager = {
+    save: jest.fn(async (entity: any, data: any) => {
+      if (entity === Message || (typeof entity === 'function' && entity.name === 'Message')) {
+        const saved = { id: `m${savedMessages.length + 1}`, ...data };
+        savedMessages.push(saved);
+        return saved;
+      }
+      return data;
+    }),
+    update: jest.fn(async () => undefined),
+  };
+  const dataSource = {
+    transaction: jest.fn(async (fn: (mgr: any) => Promise<unknown>) => fn(manager)),
+  };
+  return { conversations, messages, retrieval, ollama, savedMessages, dataSource, manager };
 }
 
 function fakeResponse() {
   const emitter = new EventEmitter();
   const writes: string[] = [];
   const res: any = Object.assign(emitter, {
     setHeader: jest.fn(),
     flushHeaders: jest.fn(),
     write: jest.fn((chunk: string) => {
       writes.push(chunk);
@@ -56,20 +72,21 @@ function parseEvents(writes: string[]) {
 }
 
 describe('ChatService', () => {
   const convo = { id: 'c1', userId: 'u1', title: 'New chat' };
 
   it('rejects access to another userΓÇÖs conversation', async () => {
     const m = makeMocks(convo);
     const svc = new ChatService(
       m.conversations as any,
       m.messages as any,
+      m.dataSource as any,
       m.retrieval as any,
       m.ollama as any,
     );
     await expect(svc.getMessages('c1', 'other')).rejects.toBeInstanceOf(
       NotFoundException,
     );
   });
 
   it('emits sources ΓåÆ tokens ΓåÆ done and persists assistant message', async () => {
     const m = makeMocks(convo);
@@ -87,20 +104,21 @@ describe('ChatService', () => {
     ] as any);
     async function* stream() {
       yield 'Hello';
       yield ' world';
     }
     m.ollama.chatStream.mockReturnValue(stream());
 
     const svc = new ChatService(
       m.conversations as any,
       m.messages as any,
+      m.dataSource as any,
       m.retrieval as any,
       m.ollama as any,
     );
     const { res, writes } = fakeResponse();
     await svc.streamAnswer('c1', 'u1', 'hi', res);
 
     const events = parseEvents(writes);
     expect(events[0].type).toBe('sources');
     expect(events.filter((e) => e.type === 'token').map((e) => e.token)).toEqual([
       'Hello',
@@ -111,42 +129,66 @@ describe('ChatService', () => {
     expect(assistant.content).toBe('Hello world');
     expect(assistant.citedChunkIds).toEqual(['k1']);
   });
 
   it('short-circuits with a canned response when no sources found', async () => {
     const m = makeMocks(convo);
     m.retrieval.search.mockResolvedValue([]);
     const svc = new ChatService(
       m.conversations as any,
       m.messages as any,
+      m.dataSource as any,
       m.retrieval as any,
       m.ollama as any,
     );
     const { res, writes } = fakeResponse();
     await svc.streamAnswer('c1', 'u1', 'q', res);
 
     const events = parseEvents(writes);
     expect(events.map((e) => e.type)).toEqual(['sources', 'token', 'done']);
     expect(m.ollama.chatStream).not.toHaveBeenCalled();
     const assistant = m.savedMessages.find((sm) => sm.role === 'assistant');
     expect(assistant).toBeDefined();
   });
 
   it('sends sanitized error message on failure and logs the real error', async () => {
     const m = makeMocks(convo);
     m.retrieval.search.mockRejectedValue(new Error('secret DB details'));
     const svc = new ChatService(
       m.conversations as any,
       m.messages as any,
+      m.dataSource as any,
       m.retrieval as any,
       m.ollama as any,
     );
     const { res, writes } = fakeResponse();
     await svc.streamAnswer('c1', 'u1', 'q', res);
 
     const events = parseEvents(writes);
     const err = events.find((e) => e.type === 'error');
     expect(err).toBeDefined();
     expect(err.message).toBe('Streaming failed');
     expect(err.message).not.toContain('secret DB details');
   });
+
+  it('saves the user message and updates the title in one transaction', async () => {
+    const m = makeMocks(convo);
+    m.retrieval.search.mockResolvedValue([]);
+    const svc = new ChatService(
+      m.conversations as any,
+      m.messages as any,
+      m.dataSource as any,
+      m.retrieval as any,
+      m.ollama as any,
+    );
+    const { res } = fakeResponse();
+    await svc.streamAnswer('c1', 'u1', 'first question', res);
+
+    expect(m.dataSource.transaction).toHaveBeenCalledTimes(1);
+    expect(m.manager.save).toHaveBeenCalled();
+    expect(m.manager.update).toHaveBeenCalledWith(
+      Conversation,
+      'c1',
+      { title: 'first question'.slice(0, 80) },
+    );
+  });
 });
diff --git a/api/src/chat/chat.service.ts b/api/src/chat/chat.service.ts
index e779344..9eb1180 100644
--- a/api/src/chat/chat.service.ts
+++ b/api/src/chat/chat.service.ts
@@ -1,14 +1,14 @@
 import { Injectable, Logger, NotFoundException } from '@nestjs/common';
 import { InjectRepository } from '@nestjs/typeorm';
 import { Response } from 'express';
-import { Repository } from 'typeorm';
+import { Repository, DataSource } from 'typeorm';
 import { Conversation } from '../entities/conversation.entity';
 import { Message } from '../entities/message.entity';
 import { ChatMessage, OllamaService } from '../llm/ollama.service';
 import { RetrievalService } from '../retrieval/retrieval.service';
 
 const HISTORY_LIMIT = 10;
 const HEARTBEAT_INTERVAL_MS = 15_000;
 
 const SYSTEM_PROMPT = `α╕äα╕╕α╕ôα╕äα╕╖α╕¡α╕£α╕╣α╣ëα╕èα╣êα╕ºα╕óα╕òα╕¡α╕Üα╕äα╕│α╕ûα╕▓α╕íα╕êα╕▓α╕üα╣Çα╕¡α╕üα╕¬α╕▓α╕úα╕éα╕¡α╕çα╕¡α╕çα╕äα╣îα╕üα╕ú (RAG assistant)
 - α╕òα╕¡α╕Üα╣éα╕öα╕óα╕¡α╣ëα╕▓α╕çα╕¡α╕┤α╕çα╕êα╕▓α╕ü "α╕Üα╕úα╕┤α╕Üα╕ùα╣Çα╕¡α╕üα╕¬α╕▓α╕ú" α╕ùα╕╡α╣êα╣âα╕½α╣ëα╕íα╕▓α╣Çα╕ùα╣êα╕▓α╕Öα╕▒α╣ëα╕Ö
@@ -17,20 +17,21 @@ const SYSTEM_PROMPT = `α╕äα╕╕α╕ôα╕äα╕╖α╕¡α╕£α╕╣α╣ëα╕èα╣êα╕ºα╕óα╕òα╕¡α╕Üα╕äα╕│α╕û
 - α╕¡α╣ëα╕▓α╕çα╕¡α╕┤α╕çα╣üα╕½α╕Ñα╣êα╕çα╕ùα╕╡α╣êα╕íα╕▓α╕öα╣ëα╕ºα╕óα╕½α╕íα╕▓α╕óα╣Çα╕Ñα╕é [1], [2] α╕òα╕▓α╕íα╕Ñα╕│α╕öα╕▒α╕Üα╕Üα╕úα╕┤α╕Üα╕ùα╕ùα╕╡α╣êα╣âα╕èα╣ë`;
 
 @Injectable()
 export class ChatService {
   private readonly logger = new Logger(ChatService.name);
 
   constructor(
     @InjectRepository(Conversation)
     private readonly conversations: Repository<Conversation>,
     @InjectRepository(Message) private readonly messages: Repository<Message>,
+    private readonly dataSource: DataSource,
     private readonly retrieval: RetrievalService,
     private readonly ollama: OllamaService,
   ) {}
 
   createConversation(userId: string) {
     return this.conversations.save(this.conversations.create({ userId }));
   }
 
   listConversations(userId: string) {
     return this.conversations.find({ where: { userId }, order: { createdAt: 'DESC' } });
@@ -103,26 +104,28 @@ ${recent}
     }, HEARTBEAT_INTERVAL_MS);
 
     try {
       const prior = await this.messages.find({
         where: { conversationId },
         order: { createdAt: 'DESC' },
         take: HISTORY_LIMIT,
       });
       prior.reverse();
 
-      await this.messages.save(
-        this.messages.create({ conversationId, role: 'user', content }),
-      );
-      if (convo.title === 'New chat') {
-        await this.conversations.update(convo.id, { title: content.slice(0, 80) });
-      }
+      await this.dataSource.transaction(async (manager) => {
+        await manager.save(Message, { conversationId, role: 'user', content });
+        if (convo.title === 'New chat') {
+          await manager.update(Conversation, convo.id, {
+            title: content.slice(0, 80),
+          });
+        }
+      });
 
       // α╕óα╕üα╣Çα╕Ñα╕┤α╕ü stream α╕êα╕▓α╕ü Ollama α╕ùα╕▒α╕Öα╕ùα╕╡α╣Çα╕íα╕╖α╣êα╕¡ client α╕¢α╕┤α╕ö connection
       const abort = new AbortController();
       res.on('close', () => {
         if (!res.writableEnded) abort.abort();
       });
 
       const searchQuery = await this.rewriteQuery(prior, content);
       const sources = await this.retrieval.search(searchQuery);
       send({
