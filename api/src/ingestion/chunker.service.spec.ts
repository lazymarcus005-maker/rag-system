import { ChunkerService } from './chunker.service';

describe('ChunkerService', () => {
  const chunker = new ChunkerService();

  it('returns single chunk for short text', () => {
    const chunks = chunker.split([{ text: 'สวัสดีครับ นี่คือเอกสารทดสอบ' }]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe('สวัสดีครับ นี่คือเอกสารทดสอบ');
  });

  it('splits long text into multiple chunks under the limit', () => {
    const para = 'ก'.repeat(400);
    const text = Array.from({ length: 10 }, () => para).join('\n\n');
    const chunks = chunker.split([{ text }]);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(1500);
    }
  });

  it('hard-splits a paragraph longer than the limit', () => {
    const chunks = chunker.split([{ text: 'ข'.repeat(4000) }]);
    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(1500);
    }
  });

  it('propagates page and section metadata to every chunk', () => {
    const chunks = chunker.split([
      { text: 'หน้าแรก', page: 1 },
      { text: 'เนื้อหาส่วนที่สอง', page: 2, section: 'บทนำ' },
    ]);
    expect(chunks[0]).toMatchObject({ page: 1, section: undefined });
    expect(chunks[1]).toMatchObject({ page: 2, section: 'บทนำ' });
  });

  it('ignores empty segments', () => {
    expect(chunker.split([{ text: '   \n\n  ' }])).toHaveLength(0);
  });
});
