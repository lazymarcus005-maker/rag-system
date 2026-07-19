import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { OllamaService } from '../llm/ollama.service';

export interface RetrievedChunk {
  id: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  content: string;
  page: number | null;
  section: string | null;
  score: number;
}

const CANDIDATE_POOL = 20;
const RRF_K = 60;
const RERANK_SNIPPET_CHARS = 400;
const RETRIEVAL_TIMEOUT_MS = 8000;

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);
  private readonly rerankEnabled: boolean;

  constructor(
    private readonly dataSource: DataSource,
    private readonly ollama: OllamaService,
    config: ConfigService,
  ) {
    this.rerankEnabled = config.get('RERANK_ENABLED', 'true') === 'true';
  }

  async search(query: string, topK = 6): Promise<RetrievedChunk[]> {
    const [embedding] = await this.ollama.embed([query]);
    const vector = `[${embedding.join(',')}]`;

    // 3-way RRF: pgvector cosine + FTS (ภาษาที่เว้นวรรค) + trigram (ภาษาไทย)
    // Cap the hybrid query with statement_timeout so a slow cold ANN scan
    // can't stall the SSE stream indefinitely.
    const candidates: RetrievedChunk[] = await this.dataSource.transaction(
      async (manager) => {
        await manager.query(`SET LOCAL statement_timeout = ${RETRIEVAL_TIMEOUT_MS}`);
        return manager.query(
          `
      WITH vec AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> $1::vector) AS rank
        FROM chunks
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT $3
      ),
      kw AS (
        SELECT id, ROW_NUMBER() OVER (
          ORDER BY ts_rank(fts, websearch_to_tsquery('simple', $2)) DESC
        ) AS rank
        FROM chunks
        WHERE fts @@ websearch_to_tsquery('simple', $2)
        LIMIT $3
      ),
      trgm AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY word_similarity($2, content) DESC) AS rank
        FROM chunks
        WHERE $2 <% content
        LIMIT $3
      ),
      fused AS (
        SELECT id, SUM(1.0 / ($4 + rank)) AS score
        FROM (
          SELECT id, rank FROM vec
          UNION ALL SELECT id, rank FROM kw
          UNION ALL SELECT id, rank FROM trgm
        ) t
        GROUP BY id
      )
      SELECT
        c.id,
        c.document_id AS "documentId",
        d.title AS "documentTitle",
        c.chunk_index AS "chunkIndex",
        c.content,
        c.page,
        c.section,
        f.score::float AS score
      FROM fused f
      JOIN chunks c ON c.id = f.id
      JOIN documents d ON d.id = c.document_id
      ORDER BY f.score DESC
      LIMIT $3
      `,
          [vector, query, CANDIDATE_POOL, RRF_K],
        );
      },
    );

    if (!this.rerankEnabled || candidates.length <= topK) {
      return candidates.slice(0, topK);
    }
    return this.rerank(query, candidates, topK);
  }

  private async rerank(
    query: string,
    candidates: RetrievedChunk[],
    topK: number,
  ): Promise<RetrievedChunk[]> {
    try {
      const passages = candidates
        .map((c, i) => `[${i}] ${c.content.slice(0, RERANK_SNIPPET_CHARS)}`)
        .join('\n\n');
      const raw = await this.ollama.chat([
        {
          role: 'user',
          content: `คุณคือระบบจัดอันดับความเกี่ยวข้องของเอกสารกับคำถาม

คำถาม: ${query}

เอกสาร:
${passages}

เลือกเอกสารที่เกี่ยวข้องกับคำถามมากที่สุดไม่เกิน ${topK} รายการ เรียงจากเกี่ยวข้องมากไปน้อย
ตอบเป็น JSON array ของหมายเลขเท่านั้น เช่น [3,0,7] ห้ามมีข้อความอื่น`,
        },
      ]);
      const match = raw.match(/\[[-\d,\s]*\]/);
      if (!match) return candidates.slice(0, topK);

      const indexes = (JSON.parse(match[0]) as number[]).filter(
        (i, pos, arr) => i >= 0 && i < candidates.length && arr.indexOf(i) === pos,
      );
      const picked = indexes.slice(0, topK).map((i) => candidates[i]);
      // เติมจาก RRF order ถ้า reranker เลือกมาไม่ครบ
      for (const c of candidates) {
        if (picked.length >= topK) break;
        if (!picked.includes(c)) picked.push(c);
      }
      return picked;
    } catch (err) {
      this.logger.warn(`Rerank failed, falling back to RRF order: ${err}`);
      return candidates.slice(0, topK);
    }
  }
}
