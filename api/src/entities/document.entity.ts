import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';

@Entity('documents')
export class DocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  filename: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes: number;

  @Column({ name: 'storage_path' })
  storagePath: string;

  @Column({ default: 'pending' })
  status: DocumentStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'chunk_count', default: 0 })
  chunkCount: number;

  @Column({ default: 0 })
  progress: number;

  @Column({ name: 'content_hash', type: 'varchar', nullable: true })
  contentHash: string | null;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
