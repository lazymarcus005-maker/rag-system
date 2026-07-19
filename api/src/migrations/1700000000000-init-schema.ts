import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1700000000000 implements MigrationInterface {
  name = 'InitSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(255) NOT NULL UNIQUE,
        password_hash varchar(255) NOT NULL,
        role varchar(20) NOT NULL DEFAULT 'user',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title varchar(500) NOT NULL,
        filename varchar(500) NOT NULL,
        mime_type varchar(100) NOT NULL,
        size_bytes bigint NOT NULL DEFAULT 0,
        storage_path varchar(1000) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'pending',
        error text,
        chunk_count int NOT NULL DEFAULT 0,
        uploaded_by uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE chunks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        chunk_index int NOT NULL,
        content text NOT NULL,
        embedding vector(1024),
        fts tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED
      )
    `);
    await queryRunner.query(
      `CREATE INDEX chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops)`,
    );
    await queryRunner.query(`CREATE INDEX chunks_fts_idx ON chunks USING gin (fts)`);
    await queryRunner.query(`CREATE INDEX chunks_document_id_idx ON chunks (document_id)`);

    await queryRunner.query(`
      CREATE TABLE conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title varchar(200) NOT NULL DEFAULT 'New chat',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role varchar(20) NOT NULL,
        content text NOT NULL,
        cited_chunk_ids jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX messages_conversation_id_idx ON messages (conversation_id, created_at)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS conversations`);
    await queryRunner.query(`DROP TABLE IF EXISTS chunks`);
    await queryRunner.query(`DROP TABLE IF EXISTS documents`);
    await queryRunner.query(`DROP TABLE IF EXISTS users`);
  }
}
