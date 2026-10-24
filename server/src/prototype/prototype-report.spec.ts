import { loadFixture } from '../../test/fixtures/fixtures.js';
import {
  datapackageSchema,
  roomStatusSchema,
  slotDataTrackerSchema,
  staticTrackerSchema,
  trackerDataSchema,
} from '../sources/archipelago/archipelago.schemas.js';
import { cheeseTrackerSchema } from '../sources/cheese/cheese.schemas.js';
import { itemNamesById } from '../sync/room-source.mapper.js';
import type { RoomSource } from '../sync/room-source.service.js';
import { buildPrototypeReport, formatTable } from './prototype-report.js';

const source: RoomSource = {
  cheese: cheeseTrackerSchema.parse(loadFixture('cheese-tracker')),
  archipelagoOrigin: 'https://archipelago.gg',
  archipelagoTrackerId: 'TrackerIdOfTheRoom0001',
  archipelagoRoomId: 'RoomIdOfTheRoomXX0001',
  roomStatus: roomStatusSchema.parse(loadFixture('ap-room-status')),
  tracker: trackerDataSchema.parse(loadFixture('ap-tracker')),
  staticTracker: staticTrackerSchema.parse(loadFixture('ap-static-tracker')),
  slotData: slotDataTrackerSchema.parse(loadFixture('ap-slot-data')),
  slotLockItemNames: itemNamesById(datapackageSchema.parse(loadFixture('ap-datapackage-slotlock')).item_name_to_id),
};

describe('buildPrototypeReport', () => {
  const report = buildPrototypeReport(source);

  it('lists the lock status of each slot', () => {
    const statusByName = Object.fromEntries(report.roster.slice(1).map((row) => [row[1], row[4]]));
    expect(statusByName).toEqual({
      Locker: 'not_locked',
      Alice: 'unlocked',
      Bob: 'locked',
      Carol: 'partially_unlocked',
      'Davey (Dave)': 'locked',
      Locker2: 'not_locked',
    });
    expect(report.roster[2]?.[5]).toBe('Bob (Locker)');
  });

  it('summarizes the players', () => {
    expect(report.players).toContainEqual(['alice_owner', '1', '1', '0', '0']);
    expect(report.players).toContainEqual(['carol', '1', '0', '1', '1']);
    expect(report.players).toContainEqual(['(unclaimed)', '1', '0', '0', '1']);
  });

  it('formats a table with aligned columns', () => {
    expect(
      formatTable([
        ['a', 'bb'],
        ['ccc', 'd'],
      ]),
    ).toBe('a    bb\nccc  d ');
  });
});
