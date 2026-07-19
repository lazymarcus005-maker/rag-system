import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { DataSource, Repository } from 'typeorm';
import { DocumentEntity } from '../entities/document.entity';
import { OllamaService } from '../llm/ollama.service';
import { ChunkerService } from './chunker.service';
import { ParserService } from './parser.service';

const EMBED_BATCH_SIZE = 16;

@Processor('ingestion', { concurrency: 2 })
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documents: Repository<DocumentEntity>,
    private readonly dataSource: DataSource,
    private readonly parser: ParserService,
    private readonly chunker: ChunkerService,
    private readonly ollama: OllamaService,
  ) {
    super();
  }

  async process(job: Job<{ documentId: string }>) {
    const { documentId } = job.data;
    const doc = await this.documents.findOneBy({ id: documentId });
    if (!doc) {
      this.logger.warn(`Document ${documentId} not found, skipping`);
      return;
    }

    try {
      await this.documents.update(doc.id, {
        status: 'processing',
        error: null,
        progress: 0,
      });

      const segments = await this.parser.parse(doc.storagePath);
      const chunks = this.chunker.split(segments);
      if (chunks.length === 0) throw new Error('No text content extracted');

      // Embed everything first so a mid-run failure never leaves the document
      // with stale chunks committed to the DB.
      const allEmbeddings: number[][] = [];
      for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
        const embeddings = await this.ollama.embed(batch.map((c) => c.content));
        allEmbeddings.push(...embeddings);
        await this.documents.update(doc.id, {
          progress: Math.round(((i + batch.length) / chunks.length) * 90),
        });
      }

      await this.dataSource.transaction(async (manager) => {
        await manager.query(`DELETE FROM chunks WHERE document_id = $1`, [doc.id]);
        for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
          const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
          const values: string[] = [];
          const params: unknown[] = [doc.id];
          batch.forEach((chunk, j) => {
            const base = params.length;
            params.push(
              i + j,
              chunk.content,
              chunk.page ?? null,
              chunk.section?.slice(0, 300) ?? null,
              `[${allEmbeddings[i + j].join(',')}]`,
            );
            values.push(
              `($1, $${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}::vector)`,
            );
          });
          await manager.query(
            `INSERT INTO chunks (document_id, chunk_index, content, page, section, embedding) VALUES ${values.join(', ')}`,
            params,
          );
        }
      });

      await this.documents.update(doc.id, {
        status: 'ready',
        chunkCount: chunks.length,
        progress: 100,
      });
      this.logger.log(`Ingested "${doc.title}" (${chunks.length} chunks)`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const maxAttempts = job.opts.attempts ?? 1;
      const isFinalAttempt = job.attemptsMade >= maxAttempts;
      this.logger.error(
        `Ingestion failed for ${doc.id} (attempt ${job.attemptsMade}/${maxAttempts}): ${message}`,
      );
      await this.documents.update(doc.id, {
        status: isFinalAttempt ? 'failed' : 'pending',
        error: message,
      });
      // โยนต่อให้ BullMQ ทำ retry ตาม backoff
      throw err;
    }
  }
}
