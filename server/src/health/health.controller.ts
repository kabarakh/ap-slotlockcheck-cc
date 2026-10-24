import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  MemoryHealthIndicator,
  type HealthCheckResult,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service.js';

const HEAP_LIMIT_BYTES = 512 * 1024 * 1024;

@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicators: HealthIndicatorService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.database(),
      () => this.memory.checkHeap('memory_heap', HEAP_LIMIT_BYTES),
      () => this.synchronization(),
    ]);
  }

  private async database() {
    const indicator = this.indicators.check('database');
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: String(error) });
    }
  }

  private async synchronization() {
    const latest = await this.prisma.room.aggregate({ _max: { lastSuccessfulSyncAt: true } });
    const lastSuccessfulSyncAt = latest._max.lastSuccessfulSyncAt;
    return this.indicators.check('synchronization').up({
      lastSuccessfulSyncAt: lastSuccessfulSyncAt?.toISOString() ?? null,
    });
  }
}
