## Commits
bb4283a fix(config): keep @babel/* dev-only, pin joi to ^17.13.3
83cd525 feat(config): add Joi env validation schema

## Stat
 api/package-lock.json             | 50 +++++++++++++++++++++++++++++
 api/package.json                  |  1 +
 api/src/config/env.schema.spec.ts | 66 +++++++++++++++++++++++++++++++++++++++
 api/src/config/env.schema.ts      | 36 +++++++++++++++++++++
 4 files changed, 153 insertions(+)

## Diff (package.json + lockfile only)
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
