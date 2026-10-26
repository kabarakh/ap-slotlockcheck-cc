import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';

import { decodePickle, PickleObject, UnsupportedPickleError, type PickleValue } from './pickle-decoder.js';

const PROTO_4 = [0x80, 0x04];
const STOP = 0x2e;
const MARK = 0x28;

const text = (value: string): number[] => {
  const encoded = [...new TextEncoder().encode(value)];
  return [0x8c, encoded.length, ...encoded];
};

const pickle = (...body: (number | number[])[]): Uint8Array => new Uint8Array([...PROTO_4, ...body.flat(), STOP]);

const decode = (...body: (number | number[])[]): PickleValue => decodePickle(pickle(...body));

const fixtureBytes = (): Uint8Array => {
  const file = readFileSync(
    join(import.meta.dirname, '..', '..', '..', 'test', 'fixtures', 'multidata-big-chill.archipelago'),
  );
  return new Uint8Array(inflateSync(file.subarray(1)));
};

describe('decodePickle', () => {
  it('decodes the constants', () => {
    expect(decode(0x4e)).toBeNull();
    expect(decode(0x88)).toBe(true);
    expect(decode(0x89)).toBe(false);
  });

  it('decodes the integer opcodes', () => {
    expect(decode(0x4b, 0xff)).toBe(255);
    expect(decode(0x4d, 0x34, 0x12)).toBe(0x1234);
    expect(decode(0x4a, 0xfe, 0xff, 0xff, 0xff)).toBe(-2);
    expect(decode(0x8a, 0x00)).toBe(0);
    expect(decode(0x8a, 0x05, 0x65, 0xa3, 0xd0, 0xb2, 0x00)).toBe(0xb2d0a365);
    expect(decode(0x8a, 0x02, 0x00, 0xff)).toBe(-256);
    expect(decode(0x8a, 0x09, [0, 0, 0, 0, 0, 0, 0, 0, 0x01])).toBe(2n ** 64n);
    expect(decode(0x8b, 0x02, 0x00, 0x00, 0x00, 0x2c, 0x01)).toBe(300);
  });

  it('decodes floats, strings and bytes', () => {
    expect(decode(0x47, 0x3f, 0xf8, 0, 0, 0, 0, 0, 0)).toBe(1.5);
    expect(decode(text('Mothwing Cloak (Hollow Knight)'))).toBe('Mothwing Cloak (Hollow Knight)');
    expect(decode(0x58, 0x03, 0, 0, 0, 0x41, 0x42, 0x43)).toBe('ABC');
    expect(decode(0x8d, 0x02, 0, 0, 0, 0, 0, 0, 0, 0x68, 0x69)).toBe('hi');
    expect(decode(0x43, 0x02, 0x01, 0x02)).toEqual(new Uint8Array([1, 2]));
    expect(decode(0x42, 0x01, 0, 0, 0, 0x07)).toEqual(new Uint8Array([7]));
  });

  it('decodes lists and tuples', () => {
    expect(decode(0x5d, 0x4b, 0x01, 0x61)).toEqual([1]);
    expect(decode(0x5d, MARK, 0x4b, 0x01, 0x4b, 0x02, 0x65)).toEqual([1, 2]);
    expect(decode(MARK, 0x4b, 0x03, 0x6c)).toEqual([3]);
    expect(decode(0x29)).toEqual([]);
    expect(decode(0x4b, 0x01, 0x85)).toEqual([1]);
    expect(decode(0x4b, 0x01, 0x4b, 0x02, 0x86)).toEqual([1, 2]);
    expect(decode(0x4b, 0x01, 0x4b, 0x02, 0x4b, 0x03, 0x87)).toEqual([1, 2, 3]);
    expect(Object.isFrozen(decode(MARK, 0x4b, 0x04, 0x74))).toBe(true);
  });

  it('decodes dictionaries and sets', () => {
    expect(decode(0x7d, 0x4b, 0x01, text('a'), 0x73)).toEqual(new Map([[1, 'a']]));
    expect(decode(0x7d, MARK, 0x4b, 0x01, 0x4b, 0x02, 0x4b, 0x03, 0x4b, 0x04, 0x75)).toEqual(
      new Map([
        [1, 2],
        [3, 4],
      ]),
    );
    expect(decode(MARK, text('k'), 0x4e, 0x64)).toEqual(new Map([['k', null]]));
    expect(decode(0x8f, MARK, 0x4b, 0x01, 0x4b, 0x02, 0x90)).toEqual(new Set([1, 2]));
    expect(decode(MARK, 0x4b, 0x05, 0x91)).toEqual(new Set([5]));
  });

  it('uses the memo and the stack opcodes', () => {
    expect(decode(0x5d, 0x94, 0x4e, 0x30, 0x68, 0x00, 0x86)).toEqual([[], []]);
    expect(decode(text('x'), 0x71, 0x07, 0x30, 0x68, 0x07)).toBe('x');
    expect(decode(text('y'), 0x72, 0x00, 0x01, 0x00, 0x00, 0x30, 0x6a, 0x00, 0x01, 0x00, 0x00)).toBe('y');
    expect(decode(0x4b, 0x09, MARK, 0x4b, 0x01, 0x31)).toBe(9);
    expect(decode(0x95, 0x01, 0, 0, 0, 0, 0, 0, 0, 0x4e)).toBeNull();
  });

  it('creates marker objects for the permitted classes', () => {
    const value = decode(
      text('NetUtils'),
      text('SlotType'),
      0x93,
      0x4b,
      0x01,
      0x85,
      0x52,
      text('NetUtils'),
      text('NetworkSlot'),
      0x93,
      0x4b,
      0x09,
      0x85,
      0x81,
      0x7d,
      0x62,
      0x86,
    ) as PickleValue[];
    expect(value[0]).toEqual(new PickleObject('NetUtils.SlotType', [1]));
    expect(value[1]).toBeInstanceOf(PickleObject);
    expect((value[1] as PickleObject).className).toBe('NetUtils.NetworkSlot');
    expect((value[1] as PickleObject).state).toEqual(new Map());
  });

  it('decodes the multidata fixture', () => {
    const root = decodePickle(fixtureBytes()) as Map<PickleValue, PickleValue>;
    expect(root.get('seed_name')).toBe('12345678901234567890');
    const slotInfo = root.get('slot_info') as Map<PickleValue, PickleValue>;
    const locker = slotInfo.get(1) as PickleObject;
    expect(locker.className).toBe('NetUtils.NetworkSlot');
    expect(locker.args.slice(0, 2)).toEqual(['Locker', 'SlotLock']);
    const locations = root.get('locations') as Map<PickleValue, Map<PickleValue, PickleValue>>;
    expect(locations.get(3)?.get(3000000101)).toEqual([501, 3, 0]);
  });

  describe('rejects', () => {
    const rejects = (bytes: Uint8Array, message: RegExp) => {
      expect(() => decodePickle(bytes)).toThrow(UnsupportedPickleError);
      expect(() => decodePickle(bytes)).toThrow(message);
    };

    it('the opcodes GLOBAL, INST, OBJ, PERSID, EXT1 and NEWOBJ_EX', () => {
      const global = [0x63, ...new TextEncoder().encode('os\nsystem\n')];
      rejects(pickle(global), /Opcode not permitted: 0x63/);
      rejects(pickle(MARK, 0x69, ...new TextEncoder().encode('os\nsystem\n')), /Opcode not permitted: 0x69/);
      rejects(pickle(MARK, 0x6f), /Opcode not permitted: 0x6f/);
      rejects(pickle(0x50, ...new TextEncoder().encode('1\n')), /Opcode not permitted: 0x50/);
      rejects(pickle(0x82, 0x01), /Opcode not permitted: 0x82/);
      rejects(pickle(0x92), /Opcode not permitted: 0x92/);
    });

    it('classes that are not permitted', () => {
      rejects(pickle(text('os'), text('system'), 0x93), /Class not permitted: os.system/);
      rejects(pickle(text('builtins'), text('eval'), 0x93), /Class not permitted: builtins.eval/);
      rejects(pickle(text('NetUtils'), text('Version'), 0x93), /Class not permitted: NetUtils.Version/);
      rejects(pickle(0x4b, 0x01, text('Hint'), 0x93), /Class names must be strings/);
    });

    it('REDUCE, NEWOBJ and BUILD on other values', () => {
      rejects(pickle(text('print'), 0x29, 0x52), /permitted only for permitted classes/);
      rejects(pickle(text('print'), 0x29, 0x81), /permitted only for permitted classes/);
      rejects(pickle(0x7d, 0x7d, 0x62), /BUILD is permitted only/);
    });

    it('a class as a value', () => {
      rejects(pickle(text('NetUtils'), text('Hint'), 0x93), /class is not permitted as a value/);
    });

    it('broken data', () => {
      rejects(new Uint8Array([0x80, 0x06, STOP]), /protocol not supported: 6/);
      rejects(new Uint8Array([0x80, 0x04, 0x4e]), /Missing STOP/);
      rejects(new Uint8Array([0x80, 0x04, 0x4a, 0x01]), /Unexpected end of data/);
      rejects(pickle(0x61), /Stack underflow/);
      rejects(pickle(0x68, 0x05), /Unknown memo index: 5/);
      rejects(pickle(0x65), /Missing MARK/);
      rejects(pickle(0x4e, 0x4b, 0x01, 0x61), /APPEND target is not a list/);
      rejects(pickle(0x29, MARK, 0x4b, 0x01, 0x65), /APPEND target is not a list/);
      rejects(pickle(0x5d, 0x4b, 0x01, 0x4b, 0x01, 0x73), /SETITEM target is not a dictionary/);
      rejects(pickle(0x5d, MARK, 0x90), /ADDITEMS target is not a set/);
      rejects(pickle(MARK, 0x4b, 0x01, 0x64), /Odd number of dictionary entries/);
    });
  });
});
