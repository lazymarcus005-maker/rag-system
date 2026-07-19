export function validateFileSignature(ext: string, buffer: Buffer): boolean {
  switch (ext) {
    case '.pdf':
      return buffer.subarray(0, 5).toString('latin1').startsWith('%PDF');
    case '.docx':
      // DOCX คือ zip: PK\x03\x04
      return (
        buffer.length >= 4 &&
        buffer[0] === 0x50 &&
        buffer[1] === 0x4b &&
        buffer[2] === 0x03 &&
        buffer[3] === 0x04
      );
    case '.md':
    case '.txt':
      // text file ต้องไม่มี null byte
      return !buffer.subarray(0, 8192).includes(0);
    default:
      return false;
  }
}
