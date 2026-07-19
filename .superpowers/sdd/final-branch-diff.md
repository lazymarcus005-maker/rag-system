## Commits
bb33866 feat(typescript): enable strict mode and fix resulting type errors
6314c95 fix(chat): save user message + title update in single transaction
a75307b feat(llm): validate embedding dimension at startup
1880638 feat(api): bound list responses with limit/offset (cap 100)
87d498f feat(chat): tighten stream rate limit to 6/min, add 20/min on create
61e4d8b feat(lifecycle): enable graceful shutdown hooks
3793fde feat(config): wire Joi validation + TypeORM retry into AppModule
bb4283a fix(config): keep @babel/* dev-only, pin joi to ^17.13.3
83cd525 feat(config): add Joi env validation schema

## Stat
 api/package-lock.json                       | 50 ++++++++++++++++++++++
 api/package.json                            |  1 +
 api/src/app.module.ts                       | 10 ++++-
 api/src/auth/auth.controller.ts             |  4 +-
 api/src/chat/chat.controller.ts             |  5 ++-
 api/src/chat/chat.service.spec.ts           | 44 ++++++++++++++++++-
 api/src/chat/chat.service.ts                | 17 +++++---
 api/src/config/env.schema.spec.ts           | 66 +++++++++++++++++++++++++++++
 api/src/config/env.schema.ts                | 36 ++++++++++++++++
 api/src/documents/documents.controller.ts   |  8 +++-
 api/src/documents/documents.service.spec.ts | 32 +++++++++++++-
 api/src/documents/documents.service.ts      |  6 ++-
 api/src/entities/conversation.entity.ts     |  8 ++--
 api/src/entities/document.entity.ts         | 28 ++++++------
 api/src/entities/message.entity.ts          | 12 +++---
 api/src/entities/refresh-token.entity.ts    | 10 ++---
 api/src/entities/user.entity.ts             | 10 ++---
 api/src/llm/ollama.service.spec.ts          | 42 ++++++++++++++++++
 api/src/llm/ollama.service.ts               | 25 ++++++++++-
 api/src/main.ts                             |  1 +
 api/src/users/users.controller.ts           |  9 +++-
 api/tsconfig.json                           |  2 +-
 22 files changed, 369 insertions(+), 57 deletions(-)

## Diff
diff --git a/api/package-lock.json b/api/package-lock.json
index a50c04d..bce2285 100644
--- a/api/package-lock.json
+++ b/api/package-lock.json
@@ -15,20 +15,21 @@
         "@nestjs/jwt": "^10.2.0",
         "@nestjs/platform-express": "^10.4.15",
         "@nestjs/swagger": "^7.4.2",
         "@nestjs/throttler": "^6.2.1",
         "@nestjs/typeorm": "^10.0.2",
         "bcryptjs": "^2.4.3",
         "bullmq": "^5.34.2",
         "class-transformer": "^0.5.1",
         "class-validator": "^0.14.1",
         "cookie-parser": "^1.4.7",
+        "joi": "^17.13.4",
         "mammoth": "^1.8.0",
         "nestjs-pino": "^4.1.0",
         "pdf-parse": "^1.1.1",
         "pg": "^8.13.1",
         "pino-http": "^10.3.0",
         "reflect-metadata": "^0.2.2",
         "rxjs": "^7.8.1",
         "typeorm": "^0.3.20"
       },
       "devDependencies": {
@@ -796,20 +797,35 @@
       "version": "1.5.0",
       "resolved": "https://registry.npmjs.org/@colors/colors/-/colors-1.5.0.tgz",
       "integrity": "sha512-ooWCrlZP11i8GImSjTHYHLkvFDP48nS4+204nGb1RiX/WXYHmJA2III9/e2DWVabCESdW7hBAEzHRqUn9OUVvQ==",
       "dev": true,
       "license": "MIT",
       "optional": true,
       "engines": {
         "node": ">=0.1.90"
       }
     },
+    "node_modules/@hapi/hoek": {
+      "version": "9.3.0",
+      "resolved": "https://registry.npmjs.org/@hapi/hoek/-/hoek-9.3.0.tgz",
+      "integrity": "sha512-/c6rf4UJlmHlC9b5BaNvzAcFv7HZ2QHaV0D4/HNlBdvFnvQq8RI4kYdhyPCl7Xj+oWvTWQ8ujhqS53LIgAe6KQ==",
+      "license": "BSD-3-Clause"
+    },
+    "node_modules/@hapi/topo": {
+      "version": "5.1.0",
+      "resolved": "https://registry.npmjs.org/@hapi/topo/-/topo-5.1.0.tgz",
+      "integrity": "sha512-foQZKJig7Ob0BMAYBfcJk8d77QtOe7Wo4ox7ff1lQYoNNAb6jwcY1ncdoy2e9wQZzvNy7ODZCYJkK8kzmcAnAg==",
+      "license": "BSD-3-Clause",
+      "dependencies": {
+        "@hapi/hoek": "^9.0.0"
+      }
+    },
     "node_modules/@ioredis/commands": {
       "version": "1.10.0",
       "resolved": "https://registry.npmjs.org/@ioredis/commands/-/commands-1.10.0.tgz",
       "integrity": "sha512-UmeW7z4LfctwoQ5wkhVzgq8tXkreED2xZGpX+Bg+zA+WJFZCT6c062AfCK/Dfk81xZnnwdhJCUMkitihRaoC2Q==",
       "license": "MIT"
     },
     "node_modules/@isaacs/cliui": {
       "version": "8.0.2",
       "resolved": "https://registry.npmjs.org/@isaacs/cliui/-/cliui-8.0.2.tgz",
       "integrity": "sha512-O8jcjabXaleOG9DQ0+ARXWZBTfnP4WNAqzuiJK7ll44AmxGKv/J2M4TPjxjY3znBCfvBXFzucm1twdyFybFqEA==",
@@ -1827,20 +1843,41 @@
     "node_modules/@pkgjs/parseargs": {
       "version": "0.11.0",
       "resolved": "https://registry.npmjs.org/@pkgjs/parseargs/-/parseargs-0.11.0.tgz",
       "integrity": "sha512-+1VkjdD0QBLPodGrJUeqarH8VAIvQODIbwh9XpP5Syisf7YoQgsJKPNFoqqLQlu+VQ/tVSshMR6loPMn8U+dPg==",
       "license": "MIT",
       "optional": true,
       "engines": {
         "node": ">=14"
       }
     },
+    "node_modules/@sideway/address": {
+      "version": "4.1.5",
+      "resolved": "https://registry.npmjs.org/@sideway/address/-/address-4.1.5.tgz",
+      "integrity": "sha512-IqO/DUQHUkPeixNQ8n0JA6102hT9CmaljNTPmQ1u8MEhBo/R4Q8eKLN/vGZxuebwOroDB4cbpjheD4+/sKFK4Q==",
+      "license": "BSD-3-Clause",
+      "dependencies": {
+        "@hapi/hoek": "^9.0.0"
+      }
+    },
+    "node_modules/@sideway/formula": {
+      "version": "3.0.1",
+      "resolved": "https://registry.npmjs.org/@sideway/formula/-/formula-3.0.1.tgz",
+      "integrity": "sha512-/poHZJJVjx3L+zVD6g9KgHfYnb443oi7wLu/XKojDviHy6HOEOA6z1Trk5aR1dGcmPenJEgb2sK2I80LeS3MIg==",
+      "license": "BSD-3-Clause"
+    },
+    "node_modules/@sideway/pinpoint": {
+      "version": "2.0.0",
+      "resolved": "https://registry.npmjs.org/@sideway/pinpoint/-/pinpoint-2.0.0.tgz",
+      "integrity": "sha512-RNiOoTPkptFtSVzQevY/yWtZwf/RxyVnPy/OcA9HBM3MlGDnBEYL5B41H0MTn0Uec8Hi+2qUtTfG2WWZBmMejQ==",
+      "license": "BSD-3-Clause"
+    },
     "node_modules/@sinclair/typebox": {
       "version": "0.27.12",
       "resolved": "https://registry.npmjs.org/@sinclair/typebox/-/typebox-0.27.12.tgz",
       "integrity": "sha512-hhyNJ+nbR6ZR7pToHvllEFun9TL0sbL+tk/ON75lo+Xas054uez98qRbsuNt7MBCyZKK4+8Yli/OAGZhmfBZ/g==",
       "dev": true,
       "license": "MIT"
     },
     "node_modules/@sinonjs/commons": {
       "version": "3.0.1",
       "resolved": "https://registry.npmjs.org/@sinonjs/commons/-/commons-3.0.1.tgz",
@@ -5900,20 +5937,33 @@
       "dependencies": {
         "has-flag": "^4.0.0"
       },
       "engines": {
         "node": ">=10"
       },
       "funding": {
         "url": "https://github.com/chalk/supports-color?sponsor=1"
       }
     },
+    "node_modules/joi": {
+      "version": "17.13.4",
+      "resolved": "https://registry.npmjs.org/joi/-/joi-17.13.4.tgz",
+      "integrity": "sha512-1RuuER6kmt8K8I3nIWvPZKi5RQCb568ZPyY4Pwjlua+yo+63ZTmIwxLZH0heBmiKN4uxjvCiarDrjaeH84xicQ==",
+      "license": "BSD-3-Clause",
+      "dependencies": {
+        "@hapi/hoek": "^9.3.0",
+        "@hapi/topo": "^5.1.0",
+        "@sideway/address": "^4.1.5",
+        "@sideway/formula": "^3.0.1",
+        "@sideway/pinpoint": "^2.0.0"
+      }
+    },
     "node_modules/joycon": {
       "version": "3.1.1",
       "resolved": "https://registry.npmjs.org/joycon/-/joycon-3.1.1.tgz",
       "integrity": "sha512-34wB/Y7MW7bzjKRjUKTa46I2Z7eV62Rkhva+KkopW7Qvv/OSWBqvkSY7vusOPrNuZcUG3tApvdVgNB8POj3SPw==",
       "dev": true,
       "license": "MIT",
       "engines": {
         "node": ">=10"
       }
     },
diff --git a/api/package.json b/api/package.json
index b3d1ba8..9308799 100644
--- a/api/package.json
+++ b/api/package.json
@@ -17,20 +17,21 @@
     "@nestjs/jwt": "^10.2.0",
     "@nestjs/platform-express": "^10.4.15",
     "@nestjs/swagger": "^7.4.2",
     "@nestjs/throttler": "^6.2.1",
     "@nestjs/typeorm": "^10.0.2",
     "bcryptjs": "^2.4.3",
     "bullmq": "^5.34.2",
     "class-transformer": "^0.5.1",
     "class-validator": "^0.14.1",
     "cookie-parser": "^1.4.7",
+    "joi": "^17.13.3",
     "mammoth": "^1.8.0",
     "nestjs-pino": "^4.1.0",
     "pdf-parse": "^1.1.1",
     "pg": "^8.13.1",
     "pino-http": "^10.3.0",
     "reflect-metadata": "^0.2.2",
     "rxjs": "^7.8.1",
     "typeorm": "^0.3.20"
   },
   "devDependencies": {
diff --git a/api/src/app.module.ts b/api/src/app.module.ts
index c8c9dd6..5083888 100644
--- a/api/src/app.module.ts
+++ b/api/src/app.module.ts
@@ -11,24 +11,29 @@ import { ChatModule } from './chat/chat.module';
 import { DocumentsModule } from './documents/documents.module';
 import { IngestionModule } from './ingestion/ingestion.module';
 import { LlmModule } from './llm/llm.module';
 import { HealthModule } from './health/health.module';
 import { InitSchema1700000000000 } from './migrations/1700000000000-init-schema';
 import { TrgmAndProgress1700000000001 } from './migrations/1700000000001-trgm-and-progress';
 import { ChunkMetadataDedup1700000000002 } from './migrations/1700000000002-chunk-metadata-dedup';
 import { RefreshTokens1700000000003 } from './migrations/1700000000003-refresh-tokens';
 import { RetrievalModule } from './retrieval/retrieval.module';
 import { UsersModule } from './users/users.module';
+import { envSchema } from './config/env.schema';
 
 @Module({
   imports: [
-    ConfigModule.forRoot({ isGlobal: true }),
+    ConfigModule.forRoot({
+      isGlobal: true,
+      validationSchema: envSchema,
+      validationOptions: { abortEarly: false, stripUnknown: true },
+    }),
     LoggerModule.forRoot({
       pinoHttp: {
         genReqId: () => randomUUID(),
         redact: ['req.headers.authorization', 'req.headers.cookie'],
         transport:
           process.env.NODE_ENV !== 'production'
             ? { target: 'pino-pretty', options: { singleLine: true } }
             : undefined,
       },
     }),
@@ -44,20 +49,23 @@ import { UsersModule } from './users/users.module';
         database: config.get('DB_NAME', 'rag'),
         autoLoadEntities: true,
         synchronize: false,
         migrations: [
           InitSchema1700000000000,
           TrgmAndProgress1700000000001,
           ChunkMetadataDedup1700000000002,
           RefreshTokens1700000000003,
         ],
         migrationsRun: true,
+        retryAttempts: 5,
+        retryDelay: 5000,
+        keepConnectionAlive: true,
       }),
     }),
     BullModule.forRootAsync({
       inject: [ConfigService],
       useFactory: (config: ConfigService) => ({
         connection: {
           host: config.get('REDIS_HOST', 'localhost'),
           port: +config.get('REDIS_PORT', 6379),
         },
       }),
diff --git a/api/src/auth/auth.controller.ts b/api/src/auth/auth.controller.ts
index 3166845..6059533 100644
--- a/api/src/auth/auth.controller.ts
+++ b/api/src/auth/auth.controller.ts
@@ -2,25 +2,25 @@ import { Body, Controller, Post, Req, Res } from '@nestjs/common';
 import { Throttle } from '@nestjs/throttler';
 import { IsEmail, IsString, MinLength } from 'class-validator';
 import { Request, Response } from 'express';
 import { AuthResult, AuthService } from './auth.service';
 
 const REFRESH_COOKIE = 'refresh_token';
 const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
 
 class CredentialsDto {
   @IsEmail()
-  email: string;
+  email!: string;
 
   @IsString()
   @MinLength(8)
-  password: string;
+  password!: string;
 }
 
 @Controller('auth')
 @Throttle({ default: { limit: 10, ttl: 60_000 } })
 export class AuthController {
   constructor(private readonly auth: AuthService) {}
 
   @Post('register')
   @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
   async register(
diff --git a/api/src/chat/chat.controller.ts b/api/src/chat/chat.controller.ts
index dbe2762..ed612bb 100644
--- a/api/src/chat/chat.controller.ts
+++ b/api/src/chat/chat.controller.ts
@@ -13,49 +13,50 @@ import {
 import { Response } from 'express';
 import { Throttle } from '@nestjs/throttler';
 import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
 import { JwtAuthGuard } from '../auth/jwt-auth.guard';
 import { ChatService } from './chat.service';
 
 class ChatDto {
   @IsString()
   @IsNotEmpty()
   @MaxLength(4000)
-  content: string;
+  content!: string;
 }
 
 @Controller('conversations')
 @UseGuards(JwtAuthGuard)
 export class ChatController {
   constructor(private readonly chat: ChatService) {}
 
   @Post()
+  @Throttle({ default: { limit: 20, ttl: 60_000 } })
   create(@Req() req: any) {
     return this.chat.createConversation(req.user.sub);
   }
 
   @Get()
   list(@Req() req: any) {
     return this.chat.listConversations(req.user.sub);
   }
 
   @Get(':id/messages')
   messages(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
     return this.chat.getMessages(id, req.user.sub);
   }
 
   @Delete(':id')
   remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
     return this.chat.deleteConversation(id, req.user.sub);
   }
 
   @Post(':id/chat')
-  @Throttle({ default: { limit: 20, ttl: 60_000 } })
+  @Throttle({ default: { limit: 6, ttl: 60_000 } })
   async stream(
     @Param('id', ParseUUIDPipe) id: string,
     @Body() dto: ChatDto,
     @Req() req: any,
     @Res() res: Response,
   ) {
     await this.chat.streamAnswer(id, req.user.sub, dto.content, res);
   }
 }
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
diff --git a/api/src/config/env.schema.spec.ts b/api/src/config/env.schema.spec.ts
new file mode 100644
index 0000000..16ca3a8
--- /dev/null
+++ b/api/src/config/env.schema.spec.ts
@@ -0,0 +1,66 @@
+import * as Joi from 'joi';
+import { envSchema } from './env.schema';
+
+function validate(env: Record<string, string | undefined>) {
+  const { error, value } = envSchema.validate(env, {
+    abortEarly: false,
+    stripUnknown: true,
+  });
+  return { error, value };
+}
+
+describe('envSchema', () => {
+  const BASE = {
+    NODE_ENV: 'production',
+    DB_HOST: 'db',
+    DB_USER: 'rag',
+    DB_PASSWORD: 'secret',
+    DB_NAME: 'rag',
+    REDIS_HOST: 'redis',
+    OLLAMA_BASE_URL: 'http://ollama:11434',
+    ADMIN_EMAIL: 'admin@local',
+    ADMIN_PASSWORD: 'adminpass1234',
+    JWT_SECRET: 'a-very-long-production-secret-key',
+  };
+
+  it('accepts a complete production config', () => {
+    const { error, value } = validate(BASE);
+    expect(error).toBeUndefined();
+    expect(value.EMBEDDING_DIM).toBe(1024);
+  });
+
+  it('requires JWT_SECRET in production', () => {
+    const { error } = validate({ ...BASE, JWT_SECRET: undefined });
+    expect(error).toBeDefined();
+    expect(error!.message).toContain('JWT_SECRET');
+  });
+
+  it('requires JWT_SECRET to be at least 16 chars in production', () => {
+    const { error } = validate({ ...BASE, JWT_SECRET: 'short' });
+    expect(error).toBeDefined();
+    expect(error!.message).toContain('JWT_SECRET');
+  });
+
+  it('does not require JWT_SECRET outside production', () => {
+    const { error, value } = validate({ ...BASE, NODE_ENV: 'development', JWT_SECRET: undefined });
+    expect(error).toBeUndefined();
+    expect(value.JWT_SECRET).toBe('dev-secret');
+  });
+
+  it('requires DB_* and REDIS_HOST and OLLAMA_BASE_URL and ADMIN_*', () => {
+    const { error } = validate({ ...BASE, DB_PASSWORD: undefined });
+    expect(error).toBeDefined();
+    expect(error!.message).toContain('DB_PASSWORD');
+  });
+
+  it('rejects non-positive EMBEDDING_DIM', () => {
+    const { error } = validate({ ...BASE, EMBEDDING_DIM: '0' });
+    expect(error).toBeDefined();
+    expect(error!.message).toContain('EMBEDDING_DIM');
+  });
+
+  it('coerces EMBEDDING_DIM to a number', () => {
+    const { value } = validate({ ...BASE, EMBEDDING_DIM: '768' });
+    expect(value.EMBEDDING_DIM).toBe(768);
+  });
+});
\ No newline at end of file
diff --git a/api/src/config/env.schema.ts b/api/src/config/env.schema.ts
new file mode 100644
index 0000000..d4e8190
--- /dev/null
+++ b/api/src/config/env.schema.ts
@@ -0,0 +1,36 @@
+import * as Joi from 'joi';
+
+export const envSchema = Joi.object({
+  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
+  API_PORT: Joi.number().default(3001),
+
+  DB_HOST: Joi.string().required(),
+  DB_PORT: Joi.number().default(5432),
+  DB_USER: Joi.string().required(),
+  DB_PASSWORD: Joi.string().required(),
+  DB_NAME: Joi.string().required(),
+
+  REDIS_HOST: Joi.string().required(),
+  REDIS_PORT: Joi.number().default(6379),
+
+  OLLAMA_BASE_URL: Joi.string().required(),
+  OLLAMA_API_KEY: Joi.string().optional(),
+  OLLAMA_CHAT_MODEL: Joi.string().default('llama3.1:8b'),
+  OLLAMA_EMBED_MODEL: Joi.string().default('bge-m3'),
+
+  EMBEDDING_DIM: Joi.number().integer().positive().default(1024),
+
+  JWT_SECRET: Joi.alternatives()
+    .conditional('NODE_ENV', {
+      is: 'production',
+      then: Joi.string().min(16).required(),
+      otherwise: Joi.string().default('dev-secret'),
+    }),
+
+  ADMIN_EMAIL: Joi.string().required(),
+  ADMIN_PASSWORD: Joi.string().required(),
+
+  UPLOAD_DIR: Joi.string().default('./uploads'),
+  RERANK_ENABLED: Joi.string().valid('true', 'false').default('true'),
+  ENABLE_DOCS: Joi.string().valid('true', 'false').optional(),
+}).unknown(true);
\ No newline at end of file
diff --git a/api/src/documents/documents.controller.ts b/api/src/documents/documents.controller.ts
index 159e073..5b8da20 100644
--- a/api/src/documents/documents.controller.ts
+++ b/api/src/documents/documents.controller.ts
@@ -1,18 +1,19 @@
 import {
   BadRequestException,
   Controller,
   Delete,
   Get,
   Param,
   ParseUUIDPipe,
   Post,
+  Query,
   Req,
   UploadedFile,
   UseGuards,
   UseInterceptors,
 } from '@nestjs/common';
 import { FileInterceptor } from '@nestjs/platform-express';
 import { diskStorage } from 'multer';
 import { extname } from 'path';
 import { randomUUID } from 'crypto';
 import { JwtAuthGuard } from '../auth/jwt-auth.guard';
@@ -41,22 +42,25 @@ export class DocumentsController {
   upload(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
     if (!file) throw new BadRequestException('No file uploaded');
     const ext = extname(file.originalname).toLowerCase();
     if (!ALLOWED_EXTENSIONS.includes(ext)) {
       throw new BadRequestException(`Unsupported file type: ${ext}`);
     }
     return this.documents.create(file, req.user.sub);
   }
 
   @Get()
-  findAll() {
-    return this.documents.findAll();
+  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
+    return this.documents.findAll(
+      limit ? Number(limit) : undefined,
+      offset ? Number(offset) : undefined,
+    );
   }
 
   @Post(':id/reindex')
   reindex(@Param('id', ParseUUIDPipe) id: string) {
     return this.documents.reindex(id);
   }
 
   @Delete(':id')
   remove(@Param('id', ParseUUIDPipe) id: string) {
     return this.documents.remove(id);
diff --git a/api/src/documents/documents.service.spec.ts b/api/src/documents/documents.service.spec.ts
index 26e8f73..4ec6926 100644
--- a/api/src/documents/documents.service.spec.ts
+++ b/api/src/documents/documents.service.spec.ts
@@ -21,21 +21,21 @@ function makeService() {
       store.set(d.id, d);
       return d;
     }),
     findOneBy: jest.fn(async (w: any) => {
       if (w.contentHash) {
         for (const d of store.values()) if (d.contentHash === w.contentHash) return d;
         return null;
       }
       return store.get(w.id) ?? null;
     }),
-    find: jest.fn(async () => Array.from(store.values())),
+    find: jest.fn(async (opts?: any) => Array.from(store.values())),
     update: jest.fn(async () => undefined),
     delete: jest.fn(async (id: string) => {
       store.delete(id);
     }),
   };
   const queue = { add: jest.fn(async () => ({ id: 'j1' })) };
   const service = new DocumentsService(documents as any, queue as any);
   return { service, documents, queue, store };
 }
 
@@ -103,11 +103,41 @@ describe('DocumentsService', () => {
       originalname: 'c.pdf',
       mimetype: 'application/pdf',
       size: PDF_HEADER.length,
       path: await writeTempPdf(),
     };
     const doc = await service.create(file, 'u1');
     await service.remove(doc.id);
     expect(documents.delete).toHaveBeenCalledWith(doc.id);
     await expect(fs.access(file.path)).rejects.toBeDefined();
   });
+
+  it('findAll applies limit and offset with defaults 100/0', async () => {
+    const { service, documents } = makeService();
+    await service.findAll();
+    expect(documents.find).toHaveBeenCalledWith({
+      order: { createdAt: 'DESC' },
+      take: 100,
+      skip: 0,
+    });
+  });
+
+  it('findAll caps limit at 100', async () => {
+    const { service, documents } = makeService();
+    await service.findAll(5000, 10);
+    expect(documents.find).toHaveBeenCalledWith({
+      order: { createdAt: 'DESC' },
+      take: 100,
+      skip: 10,
+    });
+  });
+
+  it('findAll honors a valid limit under 100', async () => {
+    const { service, documents } = makeService();
+    await service.findAll(20, 40);
+    expect(documents.find).toHaveBeenCalledWith({
+      order: { createdAt: 'DESC' },
+      take: 20,
+      skip: 40,
+    });
+  });
 });
diff --git a/api/src/documents/documents.service.ts b/api/src/documents/documents.service.ts
index 72cdcde..9d8ea86 100644
--- a/api/src/documents/documents.service.ts
+++ b/api/src/documents/documents.service.ts
@@ -49,22 +49,24 @@ export class DocumentsService {
         storagePath: file.path,
         status: 'pending',
         contentHash,
         uploadedBy,
       }),
     );
     await this.queue.add('ingest', { documentId: doc.id });
     return doc;
   }
 
-  findAll() {
-    return this.documents.find({ order: { createdAt: 'DESC' } });
+  findAll(limit = 100, offset = 0) {
+    const take = Math.min(limit, 100);
+    const skip = Math.max(offset, 0);
+    return this.documents.find({ order: { createdAt: 'DESC' }, take, skip });
   }
 
   async reindex(id: string) {
     const doc = await this.documents.findOneBy({ id });
     if (!doc) throw new NotFoundException('Document not found');
     await this.documents.update(id, { status: 'pending', error: null });
     await this.queue.add('ingest', { documentId: id });
     return { ok: true };
   }
 
diff --git a/api/src/entities/conversation.entity.ts b/api/src/entities/conversation.entity.ts
index 8c895c4..8b73b63 100644
--- a/api/src/entities/conversation.entity.ts
+++ b/api/src/entities/conversation.entity.ts
@@ -1,16 +1,16 @@
 import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
 
 @Entity('conversations')
 export class Conversation {
   @PrimaryGeneratedColumn('uuid')
-  id: string;
+  id!: string;
 
   @Column({ name: 'user_id', type: 'uuid' })
-  userId: string;
+  userId!: string;
 
   @Column({ default: 'New chat' })
-  title: string;
+  title!: string;
 
   @CreateDateColumn({ name: 'created_at' })
-  createdAt: Date;
+  createdAt!: Date;
 }
diff --git a/api/src/entities/document.entity.ts b/api/src/entities/document.entity.ts
index 3739ce2..1bba35a 100644
--- a/api/src/entities/document.entity.ts
+++ b/api/src/entities/document.entity.ts
@@ -4,51 +4,51 @@ import {
   Entity,
   PrimaryGeneratedColumn,
   UpdateDateColumn,
 } from 'typeorm';
 
 export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';
 
 @Entity('documents')
 export class DocumentEntity {
   @PrimaryGeneratedColumn('uuid')
-  id: string;
+  id!: string;
 
   @Column()
-  title: string;
+  title!: string;
 
   @Column()
-  filename: string;
+  filename!: string;
 
   @Column({ name: 'mime_type' })
-  mimeType: string;
+  mimeType!: string;
 
   @Column({ name: 'size_bytes', type: 'bigint' })
-  sizeBytes: number;
+  sizeBytes!: number;
 
   @Column({ name: 'storage_path' })
-  storagePath: string;
+  storagePath!: string;
 
   @Column({ default: 'pending' })
-  status: DocumentStatus;
+  status!: DocumentStatus;
 
   @Column({ type: 'text', nullable: true })
-  error: string | null;
+  error!: string | null;
 
   @Column({ name: 'chunk_count', default: 0 })
-  chunkCount: number;
+  chunkCount!: number;
 
   @Column({ default: 0 })
-  progress: number;
+  progress!: number;
 
   @Column({ name: 'content_hash', type: 'varchar', nullable: true })
-  contentHash: string | null;
+  contentHash!: string | null;
 
   @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
-  uploadedBy: string | null;
+  uploadedBy!: string | null;
 
   @CreateDateColumn({ name: 'created_at' })
-  createdAt: Date;
+  createdAt!: Date;
 
   @UpdateDateColumn({ name: 'updated_at' })
-  updatedAt: Date;
+  updatedAt!: Date;
 }
diff --git a/api/src/entities/message.entity.ts b/api/src/entities/message.entity.ts
index 2c3f7a2..906499a 100644
--- a/api/src/entities/message.entity.ts
+++ b/api/src/entities/message.entity.ts
@@ -1,22 +1,22 @@
 import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
 
 @Entity('messages')
 export class Message {
   @PrimaryGeneratedColumn('uuid')
-  id: string;
+  id!: string;
 
   @Column({ name: 'conversation_id', type: 'uuid' })
-  conversationId: string;
+  conversationId!: string;
 
   @Column()
-  role: 'user' | 'assistant';
+  role!: 'user' | 'assistant';
 
   @Column({ type: 'text' })
-  content: string;
+  content!: string;
 
   @Column({ name: 'cited_chunk_ids', type: 'jsonb', nullable: true })
-  citedChunkIds: string[] | null;
+  citedChunkIds!: string[] | null;
 
   @CreateDateColumn({ name: 'created_at' })
-  createdAt: Date;
+  createdAt!: Date;
 }
diff --git a/api/src/entities/refresh-token.entity.ts b/api/src/entities/refresh-token.entity.ts
index 6bc3f27..b44f75d 100644
--- a/api/src/entities/refresh-token.entity.ts
+++ b/api/src/entities/refresh-token.entity.ts
@@ -1,19 +1,19 @@
 import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
 
 @Entity('refresh_tokens')
 export class RefreshToken {
   @PrimaryGeneratedColumn('uuid')
-  id: string;
+  id!: string;
 
   @Column({ name: 'user_id', type: 'uuid' })
-  userId: string;
+  userId!: string;
 
   @Column({ name: 'token_hash', unique: true })
-  tokenHash: string;
+  tokenHash!: string;
 
   @Column({ name: 'expires_at', type: 'timestamptz' })
-  expiresAt: Date;
+  expiresAt!: Date;
 
   @CreateDateColumn({ name: 'created_at' })
-  createdAt: Date;
+  createdAt!: Date;
 }
diff --git a/api/src/entities/user.entity.ts b/api/src/entities/user.entity.ts
index f38c044..0e8e85e 100644
--- a/api/src/entities/user.entity.ts
+++ b/api/src/entities/user.entity.ts
@@ -1,19 +1,19 @@
 import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
 
 @Entity('users')
 export class User {
   @PrimaryGeneratedColumn('uuid')
-  id: string;
+  id!: string;
 
   @Column({ unique: true })
-  email: string;
+  email!: string;
 
   @Column({ name: 'password_hash' })
-  passwordHash: string;
+  passwordHash!: string;
 
   @Column({ default: 'user' })
-  role: 'admin' | 'user';
+  role!: 'admin' | 'user';
 
   @CreateDateColumn({ name: 'created_at' })
-  createdAt: Date;
+  createdAt!: Date;
 }
diff --git a/api/src/llm/ollama.service.spec.ts b/api/src/llm/ollama.service.spec.ts
new file mode 100644
index 0000000..09e6764
--- /dev/null
+++ b/api/src/llm/ollama.service.spec.ts
@@ -0,0 +1,42 @@
+import { ConfigService } from '@nestjs/config';
+import { OllamaService } from './ollama.service';
+
+function makeConfig(overrides: Record<string, unknown> = {}) {
+  return {
+    get: jest.fn((key: string, d?: unknown) =>
+      overrides[key] !== undefined ? overrides[key] : d,
+    ),
+  } as unknown as ConfigService;
+}
+
+describe('OllamaService.onModuleInit', () => {
+  it('throws when embedding dimension does not match EMBEDDING_DIM', async () => {
+    const cfg = makeConfig({ EMBEDDING_DIM: 1024 });
+    const svc = new OllamaService(cfg);
+    jest.spyOn(svc, 'embed').mockResolvedValue([new Array(768).fill(0)]);
+    await expect(svc.onModuleInit()).rejects.toThrow(/EMBEDDING_DIM.*1024.*768/);
+  });
+
+  it('does not throw when dimensions match', async () => {
+    const cfg = makeConfig({ EMBEDDING_DIM: 1024 });
+    const svc = new OllamaService(cfg);
+    jest.spyOn(svc, 'embed').mockResolvedValue([new Array(1024).fill(0)]);
+    await expect(svc.onModuleInit()).resolves.toBeUndefined();
+  });
+
+  it('warns and continues when Ollama is unreachable (embed rejects)', async () => {
+    const cfg = makeConfig({ EMBEDDING_DIM: 1024 });
+    const svc = new OllamaService(cfg);
+    jest.spyOn(svc, 'embed').mockRejectedValue(new Error('connection refused'));
+    const warn = jest.spyOn((svc as any).logger, 'warn').mockImplementation(() => undefined);
+    await expect(svc.onModuleInit()).resolves.toBeUndefined();
+    expect(warn).toHaveBeenCalled();
+  });
+
+  it('defaults EMBEDDING_DIM to 1024 when not set', async () => {
+    const cfg = makeConfig({});
+    const svc = new OllamaService(cfg);
+    jest.spyOn(svc, 'embed').mockResolvedValue([new Array(1024).fill(0)]);
+    await expect(svc.onModuleInit()).resolves.toBeUndefined();
+  });
+});
\ No newline at end of file
diff --git a/api/src/llm/ollama.service.ts b/api/src/llm/ollama.service.ts
index e9c2a32..055bb9c 100644
--- a/api/src/llm/ollama.service.ts
+++ b/api/src/llm/ollama.service.ts
@@ -1,30 +1,51 @@
-import { Injectable, InternalServerErrorException } from '@nestjs/common';
+import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
 import { ConfigService } from '@nestjs/config';
 
 export interface ChatMessage {
   role: 'system' | 'user' | 'assistant';
   content: string;
 }
 
 @Injectable()
-export class OllamaService {
+export class OllamaService implements OnModuleInit {
   private readonly baseUrl: string;
   private readonly apiKey?: string;
   readonly chatModel: string;
   readonly embedModel: string;
+  private readonly embeddingDim: number;
+  private readonly logger = new Logger(OllamaService.name);
 
   constructor(config: ConfigService) {
     this.baseUrl = config.get('OLLAMA_BASE_URL', 'http://localhost:11434');
     this.apiKey = config.get('OLLAMA_API_KEY');
     this.chatModel = config.get('OLLAMA_CHAT_MODEL', 'llama3.1:8b');
     this.embedModel = config.get('OLLAMA_EMBED_MODEL', 'bge-m3');
+    this.embeddingDim = Number(config.get('EMBEDDING_DIM', 1024));
+  }
+
+  async onModuleInit() {
+    try {
+      const [probe] = await this.embed(['dimension check']);
+      if (probe.length !== this.embeddingDim) {
+        throw new Error(
+          `Embedding dimension mismatch: EMBEDDING_DIM=${this.embeddingDim} but Ollama model "${this.embedModel}" returned ${probe.length}-dim vectors. Update EMBEDDING_DIM to match the model.`,
+        );
+      }
+    } catch (err) {
+      if (err instanceof Error && err.message.includes('Embedding dimension mismatch')) {
+        throw err;
+      }
+      this.logger.warn(
+        `Ollama unreachable during startup probe; skipping dimension validation: ${err instanceof Error ? err.message : String(err)}`,
+      );
+    }
   }
 
   private headers(): Record<string, string> {
     const headers: Record<string, string> = { 'Content-Type': 'application/json' };
     if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
     return headers;
   }
 
   async embed(texts: string[]): Promise<number[][]> {
     const res = await fetch(`${this.baseUrl}/api/embed`, {
diff --git a/api/src/main.ts b/api/src/main.ts
index f2c610c..0c6dfe5 100644
--- a/api/src/main.ts
+++ b/api/src/main.ts
@@ -4,20 +4,21 @@ import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
 import cookieParser from 'cookie-parser';
 import { Logger } from 'nestjs-pino';
 import { AppModule } from './app.module';
 
 async function bootstrap() {
   const app = await NestFactory.create(AppModule, { bufferLogs: true });
   app.useLogger(app.get(Logger));
   app.use(cookieParser());
   app.enableCors({ origin: true, credentials: true });
   app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
+  app.enableShutdownHooks();
 
   if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DOCS === 'true') {
     const config = new DocumentBuilder()
       .setTitle('RAG API')
       .setDescription('Admin document management, ingestion, hybrid retrieval, and chat.')
       .setVersion('0.1.0')
       .addBearerAuth()
       .build();
     SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
   }
diff --git a/api/src/users/users.controller.ts b/api/src/users/users.controller.ts
index e83d10e..1cea9d7 100644
--- a/api/src/users/users.controller.ts
+++ b/api/src/users/users.controller.ts
@@ -1,46 +1,51 @@
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
+  Query,
   Req,
   UseGuards,
 } from '@nestjs/common';
 import { InjectRepository } from '@nestjs/typeorm';
 import { IsIn } from 'class-validator';
 import { Repository } from 'typeorm';
 import { JwtAuthGuard } from '../auth/jwt-auth.guard';
 import { Roles, RolesGuard } from '../auth/roles';
 import { User } from '../entities/user.entity';
 
 class RoleDto {
   @IsIn(['admin', 'user'])
-  role: 'admin' | 'user';
+  role!: 'admin' | 'user';
 }
 
 @Controller('users')
 @UseGuards(JwtAuthGuard, RolesGuard)
 @Roles('admin')
 export class UsersController {
   constructor(@InjectRepository(User) private readonly users: Repository<User>) {}
 
   @Get()
-  findAll() {
+  findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
+    const take = Math.min(limit ? Number(limit) : 100, 100);
+    const skip = Math.max(offset ? Number(offset) : 0, 0);
     return this.users.find({
       select: ['id', 'email', 'role', 'createdAt'],
       order: { createdAt: 'ASC' },
+      take,
+      skip,
     });
   }
 
   @Patch(':id/role')
   async updateRole(
     @Param('id', ParseUUIDPipe) id: string,
     @Body() dto: RoleDto,
     @Req() req: any,
   ) {
     if (id === req.user.sub) {
diff --git a/api/tsconfig.json b/api/tsconfig.json
index 41c3575..f08fdc2 100644
--- a/api/tsconfig.json
+++ b/api/tsconfig.json
@@ -6,14 +6,14 @@
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
-    "strictNullChecks": true,
+    "strict": true,
     "forceConsistentCasingInFileNames": true
   }
 }
