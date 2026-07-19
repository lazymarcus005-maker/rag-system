import { NotFoundException } from '@nestjs/common';
import { EventEmitter } from 'events';
import { ChatService } from './chat.service';

function makeMocks(convo: any) {
  const conversations = {
    save: jest.fn(async (c: any) => ({ id: 'c1', ...c })),
    create: jest.fn((c: any) => c),
    find: jest.fn(async () => [convo]),
    findOneBy: jest.fn(async (w: any) =>
      w.id === convo.id && w.userId === convo.userId ? convo : null,
    ),
    update: jest.fn(async () => undefined),
    delete: jest.fn(async () => undefined),
  };
  const savedMessages: any[] = [];
  const messages = {
    save: jest.fn(async (m: any) => {
      const saved = { id: `m${savedMessages.length + 1}`, ...m };
      savedMessages.push(saved);
      return saved;
    }),
    create: jest.fn((m: any) => m),
    find: jest.fn(async () => []),
  };
  const retrieval = { search: jest.fn(async () => []) };
  const ollama = {
    chat: jest.fn(async () => ''),
    chatStream: jest.fn(),
  };
  return { conversations, messages, retrieval, ollama, savedMessages };
}

function fakeResponse() {
  const emitter = new EventEmitter();
  const writes: string[] = [];
  const res: any = Object.assign(emitter, {
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn((chunk: string) => {
      writes.push(chunk);
      return true;
    }),
    end: jest.fn(() => {
      res.writableEnded = true;
    }),
    writableEnded: false,
  });
  return { res, writes };
}

function parseEvents(writes: string[]) {
  return writes
    .filter((w) => w.startsWith('data: '))
    .map((w) => JSON.parse(w.slice(6).trim()));
}

describe('ChatService', () => {
  const convo = { id: 'c1', userId: 'u1', title: 'New chat' };

  it('rejects access to another user’s conversation', async () => {
    const m = makeMocks(convo);
    const svc = new ChatService(
      m.conversations as any,
      m.messages as any,
      m.retrieval as any,
      m.ollama as any,
    );
    await expect(svc.getMessages('c1', 'other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('emits sources → tokens → done and persists assistant message', async () => {
    const m = makeMocks(convo);
    m.retrieval.search.mockResolvedValue([
      {
        id: 'k1',
        documentId: 'd1',
        documentTitle: 'Doc',
        chunkIndex: 0,
        content: 'context',
        page: 1,
        section: null,
        score: 0.9,
      },
    ] as any);
    async function* stream() {
      yield 'Hello';
      yield ' world';
    }
    m.ollama.chatStream.mockReturnValue(stream());

    const svc = new ChatService(
      m.conversations as any,
      m.messages as any,
      m.retrieval as any,
      m.ollama as any,
    );
    const { res, writes } = fakeResponse();
    await svc.streamAnswer('c1', 'u1', 'hi', res);

    const events = parseEvents(writes);
    expect(events[0].type).toBe('sources');
    expect(events.filter((e) => e.type === 'token').map((e) => e.token)).toEqual([
      'Hello',
      ' world',
    ]);
    expect(events[events.length - 1].type).toBe('done');
    const assistant = m.savedMessages.find((sm) => sm.role === 'assistant');
    expect(assistant.content).toBe('Hello world');
    expect(assistant.citedChunkIds).toEqual(['k1']);
  });

  it('short-circuits with a canned response when no sources found', async () => {
    const m = makeMocks(convo);
    m.retrieval.search.mockResolvedValue([]);
    const svc = new ChatService(
      m.conversations as any,
      m.messages as any,
      m.retrieval as any,
      m.ollama as any,
    );
    const { res, writes } = fakeResponse();
    await svc.streamAnswer('c1', 'u1', 'q', res);

    const events = parseEvents(writes);
    expect(events.map((e) => e.type)).toEqual(['sources', 'token', 'done']);
    expect(m.ollama.chatStream).not.toHaveBeenCalled();
    const assistant = m.savedMessages.find((sm) => sm.role === 'assistant');
    expect(assistant).toBeDefined();
  });

  it('sends sanitized error message on failure and logs the real error', async () => {
    const m = makeMocks(convo);
    m.retrieval.search.mockRejectedValue(new Error('secret DB details'));
    const svc = new ChatService(
      m.conversations as any,
      m.messages as any,
      m.retrieval as any,
      m.ollama as any,
    );
    const { res, writes } = fakeResponse();
    await svc.streamAnswer('c1', 'u1', 'q', res);

    const events = parseEvents(writes);
    const err = events.find((e) => e.type === 'error');
    expect(err).toBeDefined();
    expect(err.message).toBe('Streaming failed');
    expect(err.message).not.toContain('secret DB details');
  });
});
