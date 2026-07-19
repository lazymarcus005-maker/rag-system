## Commits
61e4d8b feat(lifecycle): enable graceful shutdown hooks

## Stat
 api/src/main.ts | 1 +
 1 file changed, 1 insertion(+)

## Diff
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
