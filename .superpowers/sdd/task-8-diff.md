## Commits
bb33866 feat(typescript): enable strict mode and fix resulting type errors

## Stat
 api/src/auth/auth.controller.ts          |  4 ++--
 api/src/chat/chat.controller.ts          |  2 +-
 api/src/entities/conversation.entity.ts  |  8 ++++----
 api/src/entities/document.entity.ts      | 28 ++++++++++++++--------------
 api/src/entities/message.entity.ts       | 12 ++++++------
 api/src/entities/refresh-token.entity.ts | 10 +++++-----
 api/src/entities/user.entity.ts          | 10 +++++-----
 api/src/users/users.controller.ts        |  2 +-
 api/tsconfig.json                        |  2 +-
 9 files changed, 39 insertions(+), 39 deletions(-)

## Diff
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
index aad46c7..ed612bb 100644
--- a/api/src/chat/chat.controller.ts
+++ b/api/src/chat/chat.controller.ts
@@ -13,21 +13,21 @@ import {
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
   @Throttle({ default: { limit: 20, ttl: 60_000 } })
   create(@Req() req: any) {
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
diff --git a/api/src/users/users.controller.ts b/api/src/users/users.controller.ts
index 3f15cc1..1cea9d7 100644
--- a/api/src/users/users.controller.ts
+++ b/api/src/users/users.controller.ts
@@ -14,21 +14,21 @@ import {
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
   findAll(@Query('limit') limit?: string, @Query('offset') offset?: string) {
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
