import { Injectable } from '@nestjs/common';
import { ParsedSegment } from './parser.service';

export interface Chunk {
  content: string;
  page?: number;
  section?: string;
}

const MAX_CHARS = 1500;
const OVERLAP_CHARS = 200;

@Injectable()
export class ChunkerService {
  split(segments: ParsedSegment[]): Chunk[] {
    const chunks: Chunk[] = [];
    for (const segment of segments) {
      for (const content of this.splitText(segment.text)) {
        chunks.push({ content, page: segment.page, section: segment.section });
      }
    }
    return chunks;
  }

  private splitText(text: string): string[] {
    const paragraphs = text
      .split(/\r?\n\s*\r?\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    const chunks: string[] = [];
    let current = '';

    const flush = () => {
      if (current.trim()) chunks.push(current.trim());
      current = current.slice(-OVERLAP_CHARS);
    };

    for (const para of paragraphs) {
      if (para.length > MAX_CHARS) {
        flush();
        for (let i = 0; i < para.length; i += MAX_CHARS - OVERLAP_CHARS) {
          chunks.push(para.slice(i, i + MAX_CHARS));
        }
        current = '';
        continue;
      }
      if (current && current.length + para.length + 2 > MAX_CHARS) flush();
      current = current ? `${current}\n\n${para}` : para;
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }
}
