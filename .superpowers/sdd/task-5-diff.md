## Commits
1880638 feat(api): bound list responses with limit/offset (cap 100)

## Stat
 api/src/documents/documents.controller.ts   |  8 ++++++--
 api/src/documents/documents.service.spec.ts | 32 ++++++++++++++++++++++++++++-
 api/src/documents/documents.service.ts      |  6 ++++--
 api/src/users/users.controller.ts           |  7 ++++++-
 4 files changed, 47 insertions(+), 6 deletions(-)

## Diff
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
 
diff --git a/api/src/users/users.controller.ts b/api/src/users/users.controller.ts
index e83d10e..3f15cc1 100644
--- a/api/src/users/users.controller.ts
+++ b/api/src/users/users.controller.ts
@@ -1,20 +1,21 @@
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
 
@@ -23,24 +24,28 @@ class RoleDto {
   role: 'admin' | 'user';
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
