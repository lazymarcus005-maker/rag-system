import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { extname } from 'path';
import { Repository } from 'typeorm';
import { DocumentEntity } from '../entities/document.entity';
import { validateFileSignature } from './file-validation';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(DocumentEntity)
    private readonly documents: Repository<DocumentEntity>,
    @InjectQueue('ingestion') private readonly queue: Queue,
  ) {}

  async create(file: Express.Multer.File, uploadedBy: string) {
    const buffer = await fs.readFile(file.path);

    const ext = extname(file.originalname).toLowerCase();
    if (!validateFileSignature(ext, buffer)) {
      await fs.unlink(file.path).catch(() => undefined);
      throw new BadRequestException(
        `เนื้อหาไฟล์ไม่ตรงกับนามสกุล ${ext} — ไฟล์อาจเสียหายหรือถูกปลอมนามสกุล`,
      );
    }

    const contentHash = createHash('sha256').update(buffer).digest('hex');
    const duplicate = await this.documents.findOneBy({ contentHash });
    if (duplicate) {
      await fs.unlink(file.path).catch(() => undefined);
      throw new ConflictException(`เอกสารนี้มีอยู่ในระบบแล้ว: "${duplicate.title}"`);
    }

    const doc = await this.documents.save(
      this.documents.create({
        title: Buffer.from(file.originalname, 'latin1').toString('utf8'),
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath: file.path,
        status: 'pending',
        contentHash,
        uploadedBy,
      }),
    );
    await this.queue.add('ingest', { documentId: doc.id });
    return doc;
  }

  findAll() {
    return this.documents.find({ order: { createdAt: 'DESC' } });
  }

  async reindex(id: string) {
    const doc = await this.documents.findOneBy({ id });
    if (!doc) throw new NotFoundException('Document not found');
    await this.documents.update(id, { status: 'pending', error: null });
    await this.queue.add('ingest', { documentId: id });
    return { ok: true };
  }

  async remove(id: string) {
    const doc = await this.documents.findOneBy({ id });
    if (!doc) throw new NotFoundException('Document not found');
    await this.documents.delete(id);
    await fs.unlink(doc.storagePath).catch(() => undefined);
    return { ok: true };
  }
}
