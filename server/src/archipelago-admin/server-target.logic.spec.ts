import { releaseWhere, slotCommandName, websocketAddress } from './server-target.logic.js';

describe('websocketAddress', () => {
  it('uses wss for HTTPS and ws for HTTP', () => {
    expect(websocketAddress('https://archipelago.gg', 38281)).toBe('wss://archipelago.gg:38281');
    expect(websocketAddress('http://127.0.0.1:4010', 50000)).toBe('ws://127.0.0.1:50000');
  });
});

describe('releaseWhere', () => {
  it('selects the open locations of the spheres for each mode', () => {
    expect(releaseWhere(3, 5, 2, 'all')).toEqual({ roomId: 3, checked: false, sphere: { gte: 2, lte: 5 } });
    expect(releaseWhere(3, 2, 2, 'filler')).toEqual({
      roomId: 3,
      checked: false,
      sphere: { gte: 2, lte: 2 },
      itemType: { not: 'progression' },
    });
    expect(releaseWhere(3, 0, 1, 'marked')).toMatchObject({ fillerMarkedAt: { not: null } });
  });
});

describe('slotCommandName', () => {
  it('uses the original Archipelago name', () => {
    expect(slotCommandName({ name: 'Davey (Dave)', archipelagoName: 'Dave' })).toBe('Dave');
    expect(slotCommandName({ name: 'Bob', archipelagoName: null })).toBe('Bob');
  });
});
