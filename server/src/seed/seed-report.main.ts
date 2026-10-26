import { readFileSync } from 'node:fs';
import { formatTable } from '../prototype/prototype-report.js';
import { readMultidata } from './multidata.reader.js';
import { buildSeedReport } from './seed-report.js';

function run(): void {
  const [file] = process.argv.slice(2);
  if (!file) {
    process.stderr.write('Usage: npm run seed:report -w server -- <file.archipelago>\n');
    process.exitCode = 1;
    return;
  }
  const content = readMultidata(new Uint8Array(readFileSync(file)));
  const report = buildSeedReport(content);
  process.stdout.write(`Seed ${content.seedName}, Archipelago ${content.archipelagoVersion}\n`);
  process.stdout.write(`${content.locations.length} locations, ${content.sphereCount} spheres`);
  process.stdout.write(`, ${content.unreachableLocationCount} locations without sphere\n\n`);
  process.stdout.write(`Players\n${formatTable(report.players)}\n\nSpheres\n${formatTable(report.spheres)}\n`);
}

run();
