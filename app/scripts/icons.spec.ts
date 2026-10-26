import { describe, expect, it } from 'vitest';

import { createIco } from './icons';

describe('createIco', () => {
  it('writes an ICO header and one entry for each PNG', () => {
    const pngs = [
      { size: 16, png: Buffer.from([1, 2, 3]) },
      { size: 32, png: Buffer.from([4, 5]) },
    ];
    const ico = createIco(pngs);
    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(2);
    expect(ico.readUInt8(6)).toBe(16);
    expect(ico.readUInt32LE(6 + 8)).toBe(3);
    expect(ico.readUInt32LE(6 + 12)).toBe(6 + 2 * 16);
    expect(ico.readUInt32LE(6 + 16 + 12)).toBe(6 + 2 * 16 + 3);
    expect([...ico.subarray(ico.length - 5)]).toEqual([1, 2, 3, 4, 5]);
  });
});
