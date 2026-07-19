import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
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
import { envSchema } from './config/env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envSchema,
      validationOptions: { abortEarly: false, stripUnknown: true },
    }),
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
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: +config.get('DB_PORT', 5432),
        username: config.get('DB_USER', 'rag'),
        password: config.get('DB_PASSWORD', 'ragpassword'),
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
        retryAttempts: 5,
        retryDelay: 5000,
        keepConnectionAlive: true,
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
    }),
    AuthModule,
    LlmModule,
    DocumentsModule,
    IngestionModule,
    RetrievalModule,
    ChatModule,
    HealthModule,
    UsersModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
