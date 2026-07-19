## Commits
a75307b feat(llm): validate embedding dimension at startup

## Stat
 api/src/llm/ollama.service.spec.ts | 42 ++++++++++++++++++++++++++++++++++++++
 api/src/llm/ollama.service.ts      | 25 +++++++++++++++++++++--
 2 files changed, 65 insertions(+), 2 deletions(-)

## Diff
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
