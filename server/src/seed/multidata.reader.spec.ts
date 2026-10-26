import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

import { itemTypeFromFlags } from './item-type.js';
import { MultidataFormatError, readMultidata } from './multidata.reader.js';

const fixture = (name: string): Uint8Array =>
  new Uint8Array(readFileSync(join(import.meta.dirname, '..', '..', 'test', 'fixtures', `${name}.archipelago`)));

const withVersion = (version: number, payload: Uint8Array): Uint8Array => new Uint8Array([version, ...payload]);

const expectError = (action: () => unknown, code: string) => {
  expect(action).toThrow(MultidataFormatError);
  try {
    action();
  } catch (error) {
    expect((error as MultidataFormatError).code).toBe(code);
  }
};

describe('itemTypeFromFlags', () => {
  it.each([
    [0, 'normal'],
    [1, 'progression'],
    [2, 'useful'],
    [3, 'progression'],
    [4, 'trap'],
    [6, 'useful'],
    [9, 'progression'],
    [16, 'normal'],
  ])('maps the flags %i to %s', (flags, type) => {
    expect(itemTypeFromFlags(flags)).toBe(type);
  });
});

describe('readMultidata', () => {
  it('reads the players, the version and the seed name', () => {
    const content = readMultidata(fixture('multidata-big-chill'));
    expect(content.seedName).toBe('12345678901234567890');
    expect(content.archipelagoVersion).toBe('0.6.8');
    expect(content.players).toEqual([
      { number: 1, name: 'Locker', game: 'SlotLock' },
      { number: 2, name: 'Alice', game: 'A Link to the Past' },
      { number: 3, name: 'Bob', game: 'Hollow Knight' },
      { number: 4, name: 'Carol', game: 'Celeste' },
      { number: 5, name: 'Dave', game: 'Factorio' },
      { number: 6, name: 'Locker2', game: 'SlotLock' },
    ]);
    expect(content.sphereCount).toBe(4);
    expect(content.unreachableLocationCount).toBe(0);
  });

  it('maps the locations with names, item types and spheres', () => {
    const content = readMultidata(fixture('multidata-big-chill'));
    expect(content.locations).toHaveLength(15);
    const byId = new Map(content.locations.map((location) => [`${location.finder}:${location.locationId}`, location]));
    expect(byId.get('3:20001')).toEqual({
      finder: 3,
      receiver: 1,
      receiverName: 'Locker',
      locationId: 20001,
      locationName: 'Mothwing_Cloak',
      itemId: 1003,
      itemName: 'Unlock Alice',
      itemType: 'progression',
      sphere: 1,
    });
    expect(byId.get('3:3000000101')).toMatchObject({
      locationName: 'Crossroads_(Grub)',
      itemType: 'normal',
      sphere: 3,
    });
    expect(byId.get('2:3')).toMatchObject({ itemName: 'Bomb Trap', itemType: 'trap', sphere: 1 });
    expect(byId.get('4:201')).toMatchObject({ itemName: 'Strawberry', itemType: 'useful', sphere: 2 });
  });

  it('keeps the checksums and the names of each game', () => {
    const content = readMultidata(fixture('multidata-big-chill'));
    const slotLock = content.games.get('SlotLock');
    expect(slotLock?.checksum).toBe('slotlockchecksum0001');
    expect(slotLock?.itemNameToId.get('Unlock Carol')).toBe(1005);
    expect(content.games.get('Celeste')?.locationNameToId.get('Old Site: Strawberry 2')).toBe(201);
  });

  it('does not give the server options', () => {
    const content = readMultidata(fixture('multidata-big-chill'));
    expect(JSON.stringify(content, (_key, value: unknown) => (value instanceof Map ? [...value] : value))).not.toMatch(
      /secret/,
    );
  });

  it('ignores group slots as players and uses their names as receivers', () => {
    const content = readMultidata(fixture('multidata-item-link'));
    expect(content.players.map((player) => player.number)).toEqual([1, 2, 3, 4, 5, 6]);
    const linked = content.locations.find((location) => location.locationId === 3000000102);
    expect(linked).toMatchObject({ receiver: 7, receiverName: 'Link Group', itemName: 'Rupees (20)' });
    expect(linked?.sphere).toBe(4);
    expect(content.unreachableLocationCount).toBe(1);
  });

  it('rejects unknown format versions', () => {
    const file = fixture('multidata-big-chill');
    expectError(() => readMultidata(withVersion(2, file.subarray(1))), 'UNSUPPORTED_MULTIDATA_VERSION');
    expectError(() => readMultidata(new Uint8Array()), 'UNSUPPORTED_MULTIDATA_VERSION');
  });

  it('rejects data that is not zlib data', () => {
    expectError(() => readMultidata(withVersion(3, new Uint8Array([1, 2, 3]))), 'INVALID_MULTIDATA');
  });

  it('rejects data that is too large', () => {
    expectError(() => readMultidata(fixture('multidata-big-chill'), 100), 'MULTIDATA_TOO_LARGE');
  });

  it('rejects pickles that are not permitted', () => {
    const global = new Uint8Array([0x80, 0x04, 0x63, ...new TextEncoder().encode('os\nsystem\n'), 0x2e]);
    expectError(() => readMultidata(withVersion(3, deflateSync(global))), 'INVALID_MULTIDATA');
  });

  it('rejects pickles without the expected keys', () => {
    const noneValue = new Uint8Array([0x80, 0x04, 0x4e, 0x2e]);
    expectError(() => readMultidata(withVersion(3, deflateSync(noneValue))), 'INVALID_MULTIDATA');
  });
});
