import { loadFixture } from '../../test/fixtures/fixtures.js';
import { detectLocks } from '../lock/lock.logic.js';
import {
  datapackageSchema,
  roomStatusSchema,
  slotDataTrackerSchema,
  trackerDataSchema,
} from '../sources/archipelago/archipelago.schemas.js';
import { cheeseTrackerSchema, type CheeseTracker } from '../sources/cheese/cheese.schemas.js';
import {
  archipelagoNamesByPosition,
  itemNamesById,
  lockedSlotNamesByPosition,
  receivedItemsByPosition,
  slotIdentity,
  slotRecordsFromCheese,
} from './room-source.mapper.js';

const cheese = cheeseTrackerSchema.parse(loadFixture('cheese-tracker'));
const roomStatus = roomStatusSchema.parse(loadFixture('ap-room-status'));
const tracker = trackerDataSchema.parse(loadFixture('ap-tracker'));
const slotData = slotDataTrackerSchema.parse(loadFixture('ap-slot-data'));
const itemNames = itemNamesById(datapackageSchema.parse(loadFixture('ap-datapackage-slotlock')).item_name_to_id);
const archipelagoNames = archipelagoNamesByPosition(roomStatus, tracker);

const detect = (source: CheeseTracker, names = archipelagoNames) =>
  detectLocks({
    slots: slotRecordsFromCheese(source, names).map(slotIdentity),
    slotLockPositions: [1, 6],
    lockedSlotNamesByLocker: lockedSlotNamesByPosition(slotData, [1, 6]),
    receivedItemsByLocker: receivedItemsByPosition(tracker, [1, 6], itemNames),
    overrides: [],
  });

describe('room source mapping', () => {
  it('maps Cheese games to slot records with the Archipelago name', () => {
    const slots = slotRecordsFromCheese(cheese, archipelagoNames);
    expect(slots.map((slot) => slot.isSlotLock)).toEqual([true, false, false, false, false, true]);
    expect(slots[1]).toMatchObject({ position: 2, name: 'Alice', discordUserId: '100000000000000001' });
    expect(slots[4]).toMatchObject({
      name: 'Davey (Dave)',
      archipelagoName: 'Dave',
      discordUserId: null,
      discordName: null,
      lastActivity: null,
    });
  });

  it('reads original names and aliases by player number', () => {
    expect(archipelagoNames.get(5)).toEqual({ name: 'Dave', alias: 'Davey' });
    expect(archipelagoNames.get(2)).toEqual({ name: 'Alice', alias: null });
  });

  it('gives each slot its Cheese name, its Archipelago name and the parts of an alias display', () => {
    expect(slotIdentity({ position: 5, name: 'Davey (Dave)', archipelagoName: 'Dave' })).toEqual({
      position: 5,
      name: 'Davey (Dave)',
      aliases: ['Dave', 'Davey', 'Dave'],
    });
    expect(slotIdentity({ position: 2, name: 'Alice', archipelagoName: null }).aliases).toEqual([]);
  });

  it('maps received items to item names and senders', () => {
    const items = receivedItemsByPosition(tracker, [1, 6], itemNames);
    expect(items.get(1)).toEqual([
      { itemName: 'Unlock Alice', senderPosition: 3 },
      { itemName: 'Nothing', senderPosition: 2 },
      { itemName: 'Unlock Bonus Slot 1', senderPosition: 4 },
      { itemName: 'Unlock Alice', senderPosition: 5 },
    ]);
    expect(items.get(6)).toEqual([{ itemName: 'Unlock Carol', senderPosition: 2 }]);
  });

  it('reads the locked slots from the slot data of SlotLock slots', () => {
    expect(lockedSlotNamesByPosition(slotData, [1, 6, 2])).toEqual(
      new Map([
        [1, ['Alice', 'Bob', 'Carol']],
        [6, ['Carol', 'Dave']],
      ]),
    );
  });

  it('gives the expected lock result for the fixture room', () => {
    const result = detect(cheese);
    expect(result.assignments).toHaveLength(5);
    expect(result.firstUnlockItems).toEqual([
      { lockerPosition: 1, lockedPosition: 2, senderPosition: 3 },
      { lockerPosition: 6, lockedPosition: 4, senderPosition: 2 },
    ]);
    expect(result.unknownSlotNames).toEqual([]);
  });

  it('finds a slot that Cheese shows only with its alias', () => {
    const aliasOnly: CheeseTracker = {
      ...cheese,
      games: cheese.games.map((game) => (game.position === 5 ? { ...game, name: 'Davey' } : game)),
    };
    expect(detect(aliasOnly).unknownSlotNames).toEqual([]);
    expect(detect(aliasOnly, new Map()).unknownSlotNames).toEqual(['Dave']);
  });
});
