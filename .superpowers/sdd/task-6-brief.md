## Task 6: Embedding-dimension validation probe

**Files:**
- Modify: `api/src/llm/ollama.service.ts`
- Create: `api/src/llm/ollama.service.spec.ts`

**Interfaces:**
- Produces: `OllamaService` implements `OnModuleInit`. `onModuleInit()` probes `embed(['dimension check'])` and throws on dimension mismatch with `EMBEDDING_DIM`. Warns and continues if Ollama is unreachable.

- [ ] **Step 1: Write the failing test**

Create `api/src/llm/ollama.service.spec.ts`:

```typescript
import { ConfigService } from '@nestjs/config';
import { OllamaService } from './ollama.service';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    get: jest.fn((key: string, d?: unknown) =>
      overrides[key] !== undefined ? overrides[key] : d,
    ),
  } as unknown as ConfigService;
}

describe('OllamaService.onModuleInit', () => {
  it('throws when embedding dimension does not match EMBEDDING_DIM', async () => {
    const cfg = makeConfig({ EMBEDDING_DIM: 1024 });
    const svc = new OllamaService(cfg);
    jest.spyOn(svc, 'embed').mockResolvedValue([new Array(768).fill(0)]);
    await expect(svc.onModuleInit()).rejects.toThrow(/EMBEDDING_DIM.*1024.*768/);
  });

  it('does not throw when dimensions match', async () => {
    const cfg = makeConfig({ EMBEDDING_DIM: 1024 });
    const svc = new OllamaService(cfg);
    jest.spyOn(svc, 'embed').mockResolvedValue([new Array(1024).fill(0)]);
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
  });

  it('warns and continues when Ollama is unreachable (embed rejects)', async () => {
    const cfg = makeConfig({ EMBEDDING_DIM: 1024 });
    const svc = new OllamaService(cfg);
    jest.spyOn(svc, 'embed').mockRejectedValue(new Error('connection refused'));
    const warn = jest.spyOn((svc as any).logger, 'warn').mockImplementation(() => undefined);
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('defaults EMBEDDING_DIM to 1024 when not set', async () => {
    const cfg = makeConfig({});
    const svc = new OllamaService(cfg);
    jest.spyOn(svc, 'embed').mockResolvedValue([new Array(1024).fill(0)]);
    await expect(svc.onModuleInit()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `api/`:
```bash
npx jest src/llm/ollama.service.spec.ts
```
Expected: FAIL — `OllamaService` does not implement `onModuleInit`, so `(svc as any).onModuleInit` is undefined → rejection or "not a function".

- [ ] **Step 3: Modify OllamaService**

Edit `api/src/llm/ollama.service.ts`.

Change the imports (line 1):

```typescript
import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
```

Add `implements OnModuleInit` and a logger to the class. Replace lines 9-21:

```typescript
@Injectable()
export class OllamaService implements OnModuleInit {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  readonly chatModel: string;
  readonly embedModel: string;
  private readonly embeddingDim: number;
  private readonly logger = new Logger(OllamaService.name);

  constructor(config: ConfigService) {
    this.baseUrl = config.get('OLLAMA_BASE_URL', 'http://localhost:11434');
    this.apiKey = config.get('OLLAMA_API_KEY');
    this.chatModel = config.get('OLLAMA_CHAT_MODEL', 'llama3.1:8b');
    this.embedModel = config.get('OLLAMA_EMBED_MODEL', 'bge-m3');
    this.embeddingDim = Number(config.get('EMBEDDING_DIM', 1024));
  }

  async onModuleInit() {
    try {
      const [probe] = await this.embed(['dimension check']);
      if (probe.length !== this.embeddingDim) {
        throw new Error(
          `Embedding dimension mismatch: Ollama model "${this.embedModel}" returned ${probe.length}-dim vectors but EMBEDDING_DIM=${this.embeddingDim}. Update EMBEDDING_DIM to match the model.`,
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Embedding dimension mismatch')) {
        throw err;
      }
      this.logger.warn(
        `Ollama unreachable during startup probe; skipping dimension validation: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
```

Leave `headers()`, `embed()`, `chat()`, `ping()`, `chatStream()` unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run from `api/`:
```bash
npx jest src/llm/ollama.service.spec.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: Run full test suite**

Run from `api/`:
```bash
npm test
```
Expected: all PASS. (Existing tests don't instantiate OllamaService directly, but if they do via module init, the probe catches unreachable Ollama — the warn path returns cleanly. Verify no test boots the full AppModule.)

- [ ] **Step 6: Build**

Run from `api/`:
```bash
npm run build
```
Expected: compiles.

- [ ] **Step 7: Commit**

```bash
git add api/src/llm/ollama.service.ts api/src/llm/ollama.service.spec.ts
git commit -m "feat(llm): validate embedding dimension at startup"
```

---

