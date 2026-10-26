import { readFileSync } from 'node:fs';
import { multidataFixturePath } from '../../test/fixtures/fixtures.js';
import { readMultidata } from './multidata.reader.js';
import { buildSeedReport } from './seed-report.js';

describe('buildSeedReport', () => {
  const report = buildSeedReport(readMultidata(new Uint8Array(readFileSync(multidataFixturePath('big-chill')))));

  it('lists the players with their number of locations', () => {
    expect(report.players[0]).toEqual(['Number', 'Name', 'Game', 'Locations']);
    expect(report.players.slice(1).map((row) => [row[1], row[3]])).toEqual([
      ['Locker', '2'],
      ['Alice', '5'],
      ['Bob', '3'],
      ['Carol', '2'],
      ['Dave', '2'],
      ['Locker2', '1'],
    ]);
  });

  it('counts the item types for each sphere', () => {
    expect(report.spheres).toEqual([
      ['Sphere', 'Locations', 'Progression', 'Useful', 'Normal', 'Trap'],
      ['0', '5', '4', '0', '1', '0'],
      ['1', '4', '1', '1', '1', '1'],
      ['2', '4', '2', '1', '1', '0'],
      ['3', '2', '0', '0', '1', '1'],
    ]);
  });
});
