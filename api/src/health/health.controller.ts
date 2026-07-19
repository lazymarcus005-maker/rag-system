import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { OllamaService } from '../llm/ollama.service';

type ServiceStatus = 'ok' | 'down';

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    @InjectQueue('ingestion') private readonly queue: Queue,
    private readonly ollama: OllamaService,
  ) {}

  @Get()
  async check() {
    const [db, redis, ollama, queue] = await Promise.all([
      this.checkDb(),
      this.checkRedis(),
      this.ollama.ping().then((ok): ServiceStatus => (ok ? 'ok' : 'down')),
      this.getQueueStats(),
    ]);
    const services = { db, redis, ollama };
    const healthy = Object.values(services).every((s) => s === 'ok');
    return { status: healthy ? 'ok' : 'degraded', services, queue };
  }

  private async getQueueStats() {
    try {
      const counts = await this.queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
      );
      return { status: 'ok' as ServiceStatus, ...counts };
    } catch {
      return { status: 'down' as ServiceStatus };
    }
  }

  private async checkDb(): Promise<ServiceStatus> {
    try {
      await this.dataSource.query('SELECT 1');
      return 'ok';
    } catch {
      return 'down';
    }
  }

  private async checkRedis(): Promise<ServiceStatus> {
    try {
      const client = (await this.queue.client) as unknown as {
        ping(): Promise<string>;
      };
      await client.ping();
      return 'ok';
    } catch {
      return 'down';
    }
  }
}
