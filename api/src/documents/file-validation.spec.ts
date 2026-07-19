import { validateFileSignature } from './file-validation';

describe('validateFileSignature', () => {
  it('accepts a valid PDF header', () => {
    expect(validateFileSignature('.pdf', Buffer.from('%PDF-1.7\n...'))).toBe(true);
  });

  it('rejects a non-PDF file renamed to .pdf', () => {
    expect(validateFileSignature('.pdf', Buffer.from('MZ executable'))).toBe(false);
  });

  it('accepts a valid DOCX (zip) header', () => {
    expect(
      validateFileSignature('.docx', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14])),
    ).toBe(true);
  });

  it('rejects a plain text file renamed to .docx', () => {
    expect(validateFileSignature('.docx', Buffer.from('just text'))).toBe(false);
  });

  it('accepts UTF-8 Thai text as .txt and .md', () => {
    const thai = Buffer.from('เอกสารภาษาไทย ทดสอบ', 'utf8');
    expect(validateFileSignature('.txt', thai)).toBe(true);
    expect(validateFileSignature('.md', thai)).toBe(true);
  });

  it('rejects binary content as .txt', () => {
    expect(validateFileSignature('.txt', Buffer.from([0x00, 0x01, 0x02]))).toBe(false);
  });

  it('rejects unknown extensions', () => {
    expect(validateFileSignature('.exe', Buffer.from('%PDF'))).toBe(false);
  });
});
