import { IngestionProcessor } from './ingestion.processor';

function makeMocks() {
  const store = new Map<string, any>();
  store.set('d1', { id: 'd1', title: 'Doc', storagePath: '/tmp/x.pdf' });
  const documents = {
    findOneBy: jest.fn(async (w: any) => store.get(w.id) ?? null),
    update: jest.fn(async () => undefined),
  };
  const managerQueries: string[] = [];
  const dataSource = {
    transaction: jest.fn(async (fn: any) => {
      await fn({
        query: async (sql: string) => {
          managerQueries.push(sql.split(' ')[0]);
          return [];
        },
      });
    }),
  };
  const parser = { parse: jest.fn(async () => [{ text: 'hello world' }]) };
  const chunker = {
    split: jest.fn(() => [{ content: 'hello world', page: null, section: undefined }]),
  };
  const ollama = { embed: jest.fn(async () => [[0.1, 0.2, 0.3]]) };
  return { documents, dataSource, parser, chunker, ollama, managerQueries, store };
}

function fakeJob(overrides: Partial<{ attemptsMade: number; attempts: number }> = {}) {
  return {
    data: { documentId: 'd1' },
    attemptsMade: overrides.attemptsMade ?? 0,
    opts: { attempts: overrides.attempts ?? 3 },
  } as any;
}

function newProcessor(m: ReturnType<typeof makeMocks>) {
  return new IngestionProcessor(
    m.documents as any,
    m.dataSource as any,
    m.parser as any,
    m.chunker as any,
    m.ollama as any,
  );
}

describe('IngestionProcessor', () => {
  it('marks document ready with chunk count on success', async () => {
    const m = makeMocks();
    const proc = newProcessor(m);
    await proc.process(fakeJob());

    expect(m.dataSource.transaction).toHaveBeenCalled();
    expect(m.managerQueries).toEqual(['DELETE', 'INSERT']);
    // last update call should mark ready
    const calls = m.documents.update.mock.calls as any[];
    const lastUpdate = calls[calls.length - 1][1] as any;
    expect(lastUpdate).toMatchObject({ status: 'ready', chunkCount: 1, progress: 100 });
  });

  it('skips silently when document is missing', async () => {
    const m = makeMocks();
    m.store.clear();
    const proc = newProcessor(m);
    await expect(proc.process(fakeJob())).resolves.toBeUndefined();
    expect(m.dataSource.transaction).not.toHaveBeenCalled();
  });

  it('marks status=pending on non-final failure so BullMQ can retry', async () => {
    const m = makeMocks();
    m.parser.parse.mockRejectedValueOnce(new Error('boom'));
    const proc = newProcessor(m);
    await expect(proc.process(fakeJob({ attemptsMade: 1, attempts: 3 }))).rejects.toThrow(
      'boom',
    );
    const calls = m.documents.update.mock.calls as any[];
    const lastUpdate = calls[calls.length - 1][1] as any;
    expect(lastUpdate.status).toBe('pending');
    expect(lastUpdate.error).toBe('boom');
  });

  it('marks status=failed on final attempt', async () => {
    const m = makeMocks();
    m.parser.parse.mockRejectedValueOnce(new Error('boom'));
    const proc = newProcessor(m);
    await expect(proc.process(fakeJob({ attemptsMade: 3, attempts: 3 }))).rejects.toThrow(
      'boom',
    );
    const calls = m.documents.update.mock.calls as any[];
    const lastUpdate = calls[calls.length - 1][1] as any;
    expect(lastUpdate.status).toBe('failed');
  });

  it('throws when parser returns no content', async () => {
    const m = makeMocks();
    m.chunker.split.mockReturnValueOnce([]);
    const proc = newProcessor(m);
    await expect(proc.process(fakeJob({ attemptsMade: 3, attempts: 3 }))).rejects.toThrow(
      'No text content extracted',
    );
    expect(m.dataSource.transaction).not.toHaveBeenCalled();
  });
});
