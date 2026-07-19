import { ParserService } from './parser.service';

describe('ParserService markdown splitting', () => {
  const parser = new ParserService();
  const split = (text: string) => (parser as any).splitMarkdown(text);

  it('splits by headings and records section names', () => {
    const segments = split(
      '# บทนำ\nเนื้อหาบทนำ\n\n## การติดตั้ง\nขั้นตอนติดตั้ง\n\n## การใช้งาน\nวิธีใช้',
    );
    expect(segments).toHaveLength(3);
    expect(segments[0].section).toBe('บทนำ');
    expect(segments[1].section).toBe('การติดตั้ง');
    expect(segments[2].section).toBe('การใช้งาน');
    expect(segments[1].text).toContain('ขั้นตอนติดตั้ง');
  });

  it('keeps content before the first heading with no section', () => {
    const segments = split('ข้อความเปิด\n\n# หัวข้อแรก\nเนื้อหา');
    expect(segments[0].section).toBeUndefined();
    expect(segments[0].text).toBe('ข้อความเปิด');
  });

  it('returns whole text when there are no headings', () => {
    const segments = split('ข้อความธรรมดา ไม่มีหัวข้อ');
    expect(segments).toHaveLength(1);
    expect(segments[0].section).toBeUndefined();
  });
});
