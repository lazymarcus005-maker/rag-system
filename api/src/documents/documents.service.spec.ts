import { BadRequestException, ConflictException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DocumentsService } from './documents.service';

// Minimal PDF signature so validateFileSignature('.pdf', ...) passes.
const PDF_HEADER = Buffer.from('%PDF-1.4\n%EOF', 'utf8');

async function writeTempPdf(content = PDF_HEADER) {
  const p = path.join(os.tmpdir(), `doc-${Date.now()}-${Math.random()}.pdf`);
  await fs.writeFile(p, content);
  return p;
}

function makeService() {
  const store = new Map<string, any>();
  const documents = {
    create: jest.fn((d: any) => ({ id: `d-${store.size + 1}`, ...d })),
    save: jest.fn(async (d: any) => {
      store.set(d.id, d);
      return d;
    }),
    findOneBy: jest.fn(async (w: any) => {
      if (w.contentHash) {
        for (const d of store.values()) if (d.contentHash === w.contentHash) return d;
        return null;
      }
      return store.get(w.id) ?? null;
    }),
    find: jest.fn(async () => Array.from(store.values())),
    update: jest.fn(async () => undefined),
    delete: jest.fn(async (id: string) => {
      store.delete(id);
    }),
  };
  const queue = { add: jest.fn(async () => ({ id: 'j1' })) };
  const service = new DocumentsService(documents as any, queue as any);
  return { service, documents, queue, store };
}

describe('DocumentsService', () => {
  it('creates a document and enqueues ingestion', async () => {
    const { service, queue, store } = makeService();
    const file: any = {
      originalname: 'test.pdf',
      mimetype: 'application/pdf',
      size: PDF_HEADER.length,
      path: await writeTempPdf(),
    };
    const doc = await service.create(file, 'u1');
    expect(doc.status).toBe('pending');
    expect(doc.uploadedBy).toBe('u1');
    expect(queue.add).toHaveBeenCalledWith('ingest', { documentId: doc.id });
    expect(store.size).toBe(1);
    await fs.unlink(file.path).catch(() => undefined);
  });

  it('rejects a file whose bytes do not match its extension', async () => {
    const { service } = makeService();
    const p = path.join(os.tmpdir(), `bad-${Date.now()}.pdf`);
    await fs.writeFile(p, Buffer.from('not a pdf'));
    const file: any = {
      originalname: 'bad.pdf',
      mimetype: 'application/pdf',
      size: 9,
      path: p,
    };
    await expect(service.create(file, 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    // File should have been cleaned up.
    await expect(fs.access(p)).rejects.toBeDefined();
  });

  it('rejects duplicate content and cleans up the upload', async () => {
    const { service } = makeService();
    const first: any = {
      originalname: 'a.pdf',
      mimetype: 'application/pdf',
      size: PDF_HEADER.length,
      path: await writeTempPdf(),
    };
    await service.create(first, 'u1');

    const dupPath = await writeTempPdf();
    const dup: any = {
      originalname: 'b.pdf',
      mimetype: 'application/pdf',
      size: PDF_HEADER.length,
      path: dupPath,
    };
    await expect(service.create(dup, 'u1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(fs.access(dupPath)).rejects.toBeDefined();
    await fs.unlink(first.path).catch(() => undefined);
  });

  it('remove() deletes the row and unlinks the file', async () => {
    const { service, documents } = makeService();
    const file: any = {
      originalname: 'c.pdf',
      mimetype: 'application/pdf',
      size: PDF_HEADER.length,
      path: await writeTempPdf(),
    };
    const doc = await service.create(file, 'u1');
    await service.remove(doc.id);
    expect(documents.delete).toHaveBeenCalledWith(doc.id);
    await expect(fs.access(file.path)).rejects.toBeDefined();
  });
});
