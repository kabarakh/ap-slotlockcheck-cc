import { NestFactory } from '@nestjs/core';

import { RoomSourceService } from '../sync/room-source.service.js';
import { buildPrototypeReport, formatTable } from './prototype-report.js';
import { PrototypeModule } from './prototype.module.js';

async function run(): Promise<void> {
  const [cheeseTrackerId, positions] = process.argv.slice(2);
  if (!cheeseTrackerId) {
    process.stderr.write('Usage: npm run prototype:report -w server -- <cheeseTrackerId> [slotLockPositions]\n');
    process.exitCode = 1;
    return;
  }
  const app = await NestFactory.createApplicationContext(PrototypeModule, { logger: ['warn', 'error'] });
  try {
    const source = await app.get(RoomSourceService).fetch(cheeseTrackerId);
    const report = buildPrototypeReport(source, positions?.split(',').map(Number));
    process.stdout.write(`${source.cheese.title}\n\nRoster\n${formatTable(report.roster)}\n\n`);
    process.stdout.write(`Player summary\n${formatTable(report.players)}\n`);
    if (report.unknownSlotNames.length > 0) {
      process.stdout.write(`\nUnknown slot names: ${report.unknownSlotNames.join(', ')}\n`);
    }
  } finally {
    await app.close();
  }
}

await run();
