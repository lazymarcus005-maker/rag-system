import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { extname } from 'path';
import * as mammoth from 'mammoth';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

export interface ParsedSegment {
  text: string;
  page?: number;
  section?: string;
}

@Injectable()
export class ParserService {
  async parse(filePath: string): Promise<ParsedSegment[]> {
    const ext = extname(filePath).toLowerCase();
    switch (ext) {
      case '.pdf':
        return this.parsePdf(filePath);
      case '.docx': {
        const result = await mammoth.extractRawText({ path: filePath });
        return [{ text: result.value }];
      }
      case '.md':
        return this.splitMarkdown(await fs.readFile(filePath, 'utf8'));
      case '.txt':
        return [{ text: await fs.readFile(filePath, 'utf8') }];
      default:
        throw new Error(`Unsupported file type: ${ext}`);
    }
  }

  private async parsePdf(filePath: string): Promise<ParsedSegment[]> {
    const buffer = await fs.readFile(filePath);
    const pages: string[] = [];
    await pdfParse(buffer, {
      pagerender: (pageData: any) =>
        pageData
          .getTextContent({ normalizeWhitespace: true })
          .then((textContent: any) => {
            let lastY: number | undefined;
            let text = '';
            for (const item of textContent.items) {
              const y = item.transform[5];
              text += lastY === undefined || lastY === y ? item.str : `\n${item.str}`;
              lastY = y;
            }
            pages.push(text);
            return text;
          }),
    });
    return pages
      .map((text, i) => ({ text, page: i + 1 }))
      .filter((s) => s.text.trim().length > 0);
  }

  private splitMarkdown(text: string): ParsedSegment[] {
    const lines = text.split(/\r?\n/);
    const segments: ParsedSegment[] = [];
    let section: string | undefined;
    let buffer: string[] = [];

    const flush = () => {
      const t = buffer.join('\n').trim();
      if (t) segments.push({ text: t, section });
      buffer = [];
    };

    for (const line of lines) {
      const heading = line.match(/^#{1,6}\s+(.+)/);
      if (heading) {
        flush();
        section = heading[1].trim();
      }
      buffer.push(line);
    }
    flush();
    return segments.length > 0 ? segments : [{ text }];
  }
}
