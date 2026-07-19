import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChunkMetadataDedup1700000000002 implements MigrationInterface {
  name = 'ChunkMetadataDedup1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE chunks ADD COLUMN page int`);
    await queryRunner.query(`ALTER TABLE chunks ADD COLUMN section varchar(300)`);
    await queryRunner.query(
      `ALTER TABLE documents ADD COLUMN content_hash varchar(64)`,
    );
    await queryRunner.query(
      `CREATE INDEX documents_content_hash_idx ON documents (content_hash)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS documents_content_hash_idx`);
    await queryRunner.query(`ALTER TABLE documents DROP COLUMN content_hash`);
    await queryRunner.query(`ALTER TABLE chunks DROP COLUMN section`);
    await queryRunner.query(`ALTER TABLE chunks DROP COLUMN page`);
  }
}
