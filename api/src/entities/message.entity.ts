import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId!: string;

  @Column()
  role!: 'user' | 'assistant';

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'cited_chunk_ids', type: 'jsonb', nullable: true })
  citedChunkIds!: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
