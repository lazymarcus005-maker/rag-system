import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentEntity } from '../entities/document.entity';
import { ChunkerService } from './chunker.service';
import { IngestionProcessor } from './ingestion.processor';
import { ParserService } from './parser.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity]),
    BullModule.registerQueue({ name: 'ingestion' }),
  ],
  providers: [IngestionProcessor, ParserService, ChunkerService],
})
export class IngestionModule {}
