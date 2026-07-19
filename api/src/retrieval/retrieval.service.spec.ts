import { RetrievalService, RetrievedChunk } from './retrieval.service';

const makeCandidates = (n: number): RetrievedChunk[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `chunk-${i}`,
    documentId: 'doc-1',
    documentTitle: 'Doc',
    chunkIndex: i,
    content: `เนื้อหา chunk ${i}`,
    page: null,
    section: null,
    score: 1 - i * 0.01,
  }));

function makeService(ollamaChat: jest.Mock, rerankEnabled = 'true') {
  const managerQuery = jest
    .fn()
    // First call inside the tx is SET LOCAL statement_timeout — returns nothing meaningful.
    .mockImplementation((sql: string) =>
      sql.startsWith('SET LOCAL')
        ? Promise.resolve([])
        : Promise.resolve(makeCandidates(8)),
    );
  const dataSource = {
    transaction: jest.fn(async (fn: any) => fn({ query: managerQuery })),
  };
  const ollama = {
    embed: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    chat: ollamaChat,
  };
  const config = { get: jest.fn().mockReturnValue(rerankEnabled) };
  return new RetrievalService(dataSource as any, ollama as any, config as any);
}

describe('RetrievalService rerank', () => {
  it('reorders candidates according to the reranker output', async () => {
    const service = makeService(jest.fn().mockResolvedValue('[2, 0, 5]'));
    const result = await service.search('คำถาม', 3);
    expect(result.map((c) => c.id)).toEqual(['chunk-2', 'chunk-0', 'chunk-5']);
  });

  it('fills remaining slots from RRF order when reranker picks too few', async () => {
    const service = makeService(jest.fn().mockResolvedValue('[7]'));
    const result = await service.search('คำถาม', 3);
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('chunk-7');
    expect(result.slice(1).map((c) => c.id)).toEqual(['chunk-0', 'chunk-1']);
  });

  it('falls back to RRF order on unparseable reranker output', async () => {
    const service = makeService(jest.fn().mockResolvedValue('ขออภัย ฉันตอบไม่ได้'));
    const result = await service.search('คำถาม', 3);
    expect(result.map((c) => c.id)).toEqual(['chunk-0', 'chunk-1', 'chunk-2']);
  });

  it('falls back to RRF order when the reranker call throws', async () => {
    const service = makeService(jest.fn().mockRejectedValue(new Error('ollama down')));
    const result = await service.search('คำถาม', 3);
    expect(result.map((c) => c.id)).toEqual(['chunk-0', 'chunk-1', 'chunk-2']);
  });

  it('skips reranking entirely when disabled', async () => {
    const chat = jest.fn();
    const service = makeService(chat, 'false');
    const result = await service.search('คำถาม', 3);
    expect(chat).not.toHaveBeenCalled();
    expect(result).toHaveLength(3);
  });

  it('ignores out-of-range and duplicate indexes from the reranker', async () => {
    const service = makeService(jest.fn().mockResolvedValue('[99, 1, 1, -2, 3]'));
    const result = await service.search('คำถาม', 2);
    expect(result.map((c) => c.id)).toEqual(['chunk-1', 'chunk-3']);
  });
});
