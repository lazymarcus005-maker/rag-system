## Commits
3793fde feat(config): wire Joi validation + TypeORM retry into AppModule

## Stat
 api/src/app.module.ts | 10 +++++++++-
 1 file changed, 9 insertions(+), 1 deletion(-)

## Diff
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
