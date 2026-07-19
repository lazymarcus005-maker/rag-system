import { ConfigService } from '@nestjs/config';
import { DimensionMismatchError, OllamaService } from './ollama.service';

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    get: jest.fn((key: string, d?: unknown) =>
      overrides[key] !== undefined ? overrides[key] : d,
    ),
  } as unknown as ConfigService;
}

describe('OllamaService.onModuleInit', () => {
  it('throws DimensionMismatchError when dimension does not match EMBEDDING_DIM', async () => {
    const cfg = makeConfig({ EMBEDDING_DIM: 1024 });
    const svc = new OllamaService(cfg);
    jest.spyOn(svc, 'embed').mockResolvedValue([new Array(768).fill(0)]);
    await expect(svc.onModuleInit()).rejects.toBeInstanceOf(DimensionMismatchError);
  });

  it('DimensionMismatchError message contains both dimensions', async () => {
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

  it('rethrows even if an unrelated error message contains the mismatch phrase', async () => {
    const cfg = makeConfig({ EMBEDDING_DIM: 1024 });
    const svc = new OllamaService(cfg);
    jest.spyOn(svc, 'embed').mockRejectedValue(new Error('Embedding dimension mismatch (fake)'));
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