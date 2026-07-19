import { MigrationInterface, QueryRunner } from 'typeorm';

export class TrgmAndProgress1700000000001 implements MigrationInterface {
  name = 'TrgmAndProgress1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(
      `CREATE INDEX chunks_content_trgm_idx ON chunks USING gin (content gin_trgm_ops)`,
    );
    await queryRunner.query(
      `ALTER TABLE documents ADD COLUMN progress int NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE documents DROP COLUMN progress`);
    await queryRunner.query(`DROP INDEX IF EXISTS chunks_content_trgm_idx`);
  }
}
