import { seedDifferences, type RoomSlotIdentity } from './seed-match.logic.js';

const slots: RoomSlotIdentity[] = [
  { position: 2, name: 'Alice', archipelagoName: null, game: 'A Link to the Past' },
  { position: 1, name: 'Locker', archipelagoName: null, game: 'SlotLock' },
  { position: 3, name: 'Davey (Dave)', archipelagoName: 'Dave', game: 'Factorio' },
];

describe('seedDifferences', () => {
  it('accepts a file with the same players', () => {
    expect(
      seedDifferences(slots, [
        { number: 1, name: 'Locker', game: 'SlotLock' },
        { number: 2, name: 'Alice', game: 'A Link to the Past' },
        { number: 3, name: 'Dave', game: 'Factorio' },
      ]),
    ).toEqual([]);
  });

  it('lists other names, other games, missing and additional players', () => {
    expect(
      seedDifferences(slots, [
        { number: 1, name: 'Locker', game: 'Celeste' },
        { number: 2, name: 'Alicia', game: 'A Link to the Past' },
        { number: 4, name: 'Eve', game: 'Celeste' },
      ]),
    ).toEqual([
      '#1 Locker (SlotLock): Locker (Celeste) in the file',
      '#2 Alice (A Link to the Past): Alicia (A Link to the Past) in the file',
      '#3 Dave: missing in the file',
      '#4 Eve (Celeste): missing in the room',
    ]);
  });
});
