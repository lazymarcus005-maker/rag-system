## Commits
83cd525 feat(config): add Joi env validation schema

## Stat
 api/package-lock.json             | 54 ++++++++++++++++++++++++++++++--
 api/package.json                  |  2 ++
 api/src/config/env.schema.spec.ts | 66 +++++++++++++++++++++++++++++++++++++++
 api/src/config/env.schema.ts      | 36 +++++++++++++++++++++
 4 files changed, 155 insertions(+), 3 deletions(-)

## Diff
diff --git a/api/package-lock.json b/api/package-lock.json
index a50c04d..e0b3a8c 100644
--- a/api/package-lock.json
+++ b/api/package-lock.json
@@ -1,34 +1,36 @@
 {
   "name": "rag-api",
   "version": "0.1.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "rag-api",
       "version": "0.1.0",
       "dependencies": {
+        "@babel/types": "^7.29.7",
         "@nestjs/bullmq": "^10.2.3",
         "@nestjs/common": "^10.4.15",
         "@nestjs/config": "^3.3.0",
         "@nestjs/core": "^10.4.15",
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
@@ -400,31 +402,29 @@
       "dev": true,
       "license": "MIT",
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/helper-string-parser": {
       "version": "7.29.7",
       "resolved": "https://registry.npmjs.org/@babel/helper-string-parser/-/helper-string-parser-7.29.7.tgz",
       "integrity": "sha512-Pb5ijPrZ89GDH8223L4UP8i6QApWxs04RbPQJTeWDV0/keR2E36MeKnyr6LYmUUvqRRI+Iv87SuF1W6ErINzYw==",
-      "dev": true,
       "license": "MIT",
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/helper-validator-identifier": {
       "version": "7.29.7",
       "resolved": "https://registry.npmjs.org/@babel/helper-validator-identifier/-/helper-validator-identifier-7.29.7.tgz",
       "integrity": "sha512-qehxGkRj55h/ff8EMaJ+cYhyaKlHIxqYDn682wQD7RNp9UujOQsHog2uS0r2vzr4pW+sXf90NeeayjcNaX3fFg==",
-      "dev": true,
       "license": "MIT",
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@babel/helper-validator-option": {
       "version": "7.29.7",
       "resolved": "https://registry.npmjs.org/@babel/helper-validator-option/-/helper-validator-option-7.29.7.tgz",
       "integrity": "sha512-N9ZErrD+yW5geCDtBqnOoxmR8+tNKiGuxKlDpuJxfsqpa2dFcexaziGAE/qoHLiDDreVNMupxGmSoNlyvsA3gw==",
       "dev": true,
@@ -758,21 +758,20 @@
       "version": "2.1.3",
       "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
       "integrity": "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==",
       "dev": true,
       "license": "MIT"
     },
     "node_modules/@babel/types": {
       "version": "7.29.7",
       "resolved": "https://registry.npmjs.org/@babel/types/-/types-7.29.7.tgz",
       "integrity": "sha512-4zBIxpPzowiZpusoFkyGVwakdRJUyuH5PxQ/PrqghfdFWWasvnCdPfQXHrenDai+gyLARulZjZowCOj6fjT4pA==",
-      "dev": true,
       "license": "MIT",
       "dependencies": {
         "@babel/helper-string-parser": "^7.29.7",
         "@babel/helper-validator-identifier": "^7.29.7"
       },
       "engines": {
         "node": ">=6.9.0"
       }
     },
     "node_modules/@bcoe/v8-coverage": {
@@ -796,20 +795,35 @@
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
@@ -1827,20 +1841,41 @@
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
@@ -5900,20 +5935,33 @@
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
index b3d1ba8..514f759 100644
--- a/api/package.json
+++ b/api/package.json
@@ -3,34 +3,36 @@
   "version": "0.1.0",
   "private": true,
   "scripts": {
     "build": "nest build",
     "start": "nest start",
     "start:dev": "nest start --watch",
     "start:prod": "node dist/main",
     "test": "jest"
   },
   "dependencies": {
+    "@babel/types": "^7.29.7",
     "@nestjs/bullmq": "^10.2.3",
     "@nestjs/common": "^10.4.15",
     "@nestjs/config": "^3.3.0",
     "@nestjs/core": "^10.4.15",
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
+    "joi": "^17.13.4",
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
