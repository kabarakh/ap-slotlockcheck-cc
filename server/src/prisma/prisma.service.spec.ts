import { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from './prisma.service.js';

describe('PrismaService', () => {
  it('connects to an in-memory database', async () => {
    const config = { get: () => 'file::memory:' } as unknown as AppConfigService;
    const prisma = new PrismaService(config);
    await prisma.onModuleInit();
    const rows = await prisma.$queryRaw<{ value: number }[]>`SELECT 1 AS value`;
    expect(Number(rows[0]?.value)).toBe(1);
    await prisma.onModuleDestroy();
  });
});
