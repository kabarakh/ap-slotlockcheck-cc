export const PERMITTED_PICKLE_CLASSES = [
  'NetUtils.NetworkSlot',
  'NetUtils.SlotType',
  'NetUtils.Hint',
  'NetUtils.HintStatus',
] as const;

export type PermittedPickleClass = (typeof PERMITTED_PICKLE_CLASSES)[number];

export class PickleClass {
  constructor(readonly name: PermittedPickleClass) {}
}

export class PickleObject {
  state: PickleValue = null;

  constructor(
    readonly className: PermittedPickleClass,
    readonly args: readonly PickleValue[],
  ) {}
}

export type PickleValue =
  | null
  | boolean
  | number
  | bigint
  | string
  | Uint8Array
  | PickleValue[]
  | readonly PickleValue[]
  | Map<PickleValue, PickleValue>
  | Set<PickleValue>
  | PickleObject;

type StackEntry = PickleValue | PickleClass;

export class UnsupportedPickleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedPickleError';
  }
}

const MAXIMUM_PROTOCOL = 5;

const OPCODES = {
  MARK: 0x28,
  STOP: 0x2e,
  POP: 0x30,
  POP_MARK: 0x31,
  BINFLOAT: 0x47,
  BININT: 0x4a,
  BININT1: 0x4b,
  BININT2: 0x4d,
  NONE: 0x4e,
  REDUCE: 0x52,
  BINUNICODE: 0x58,
  EMPTY_LIST: 0x5d,
  APPEND: 0x61,
  BUILD: 0x62,
  DICT: 0x64,
  APPENDS: 0x65,
  BINGET: 0x68,
  LONG_BINGET: 0x6a,
  LIST: 0x6c,
  BINPUT: 0x71,
  LONG_BINPUT: 0x72,
  SETITEM: 0x73,
  TUPLE: 0x74,
  SETITEMS: 0x75,
  EMPTY_DICT: 0x7d,
  EMPTY_TUPLE: 0x29,
  PROTO: 0x80,
  NEWOBJ: 0x81,
  TUPLE1: 0x85,
  TUPLE2: 0x86,
  TUPLE3: 0x87,
  NEWTRUE: 0x88,
  NEWFALSE: 0x89,
  LONG1: 0x8a,
  LONG4: 0x8b,
  SHORT_BINBYTES: 0x43,
  BINBYTES: 0x42,
  SHORT_BINUNICODE: 0x8c,
  BINUNICODE8: 0x8d,
  EMPTY_SET: 0x8f,
  ADDITEMS: 0x90,
  FROZENSET: 0x91,
  STACK_GLOBAL: 0x93,
  MEMOIZE: 0x94,
  FRAME: 0x95,
} as const;

function isPermittedClass(name: string): name is PermittedPickleClass {
  return (PERMITTED_PICKLE_CLASSES as readonly string[]).includes(name);
}

function littleEndianSignedInteger(bytes: Uint8Array): number | bigint {
  if (bytes.length === 0) {
    return 0;
  }
  let value = 0n;
  for (let index = bytes.length - 1; index >= 0; index -= 1) {
    value = (value << 8n) | BigInt(bytes[index] ?? 0);
  }
  if (((bytes[bytes.length - 1] ?? 0) & 0x80) !== 0) {
    value -= 1n << BigInt(bytes.length * 8);
  }
  return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value;
}

class PickleReader {
  private position = 0;
  private readonly view: DataView;
  private readonly textDecoder = new TextDecoder('utf-8');

  constructor(private readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get atEnd(): boolean {
    return this.position >= this.bytes.length;
  }

  byte(): number {
    this.ensure(1);
    const value = this.view.getUint8(this.position);
    this.position += 1;
    return value;
  }

  uint16(): number {
    this.ensure(2);
    const value = this.view.getUint16(this.position, true);
    this.position += 2;
    return value;
  }

  int32(): number {
    this.ensure(4);
    const value = this.view.getInt32(this.position, true);
    this.position += 4;
    return value;
  }

  uint32(): number {
    this.ensure(4);
    const value = this.view.getUint32(this.position, true);
    this.position += 4;
    return value;
  }

  uint64(): number {
    this.ensure(8);
    const value = this.view.getBigUint64(this.position, true);
    this.position += 8;
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new UnsupportedPickleError('Length is too large');
    }
    return Number(value);
  }

  float64(): number {
    this.ensure(8);
    const value = this.view.getFloat64(this.position, false);
    this.position += 8;
    return value;
  }

  slice(length: number): Uint8Array {
    this.ensure(length);
    const value = this.bytes.subarray(this.position, this.position + length);
    this.position += length;
    return value;
  }

  text(length: number): string {
    return this.textDecoder.decode(this.slice(length));
  }

  private ensure(length: number): void {
    if (this.position + length > this.bytes.length) {
      throw new UnsupportedPickleError('Unexpected end of data');
    }
  }
}

export function decodePickle(bytes: Uint8Array): PickleValue {
  return new PickleDecoder(new PickleReader(bytes)).decode();
}

class PickleDecoder {
  private stack: StackEntry[] = [];
  private readonly marks: StackEntry[][] = [];
  private readonly memo = new Map<number, StackEntry>();

  constructor(private readonly reader: PickleReader) {}

  decode(): PickleValue {
    while (!this.reader.atEnd) {
      const opcode = this.reader.byte();
      if (opcode === OPCODES.STOP) {
        return this.value(this.pop());
      }
      this.execute(opcode);
    }
    throw new UnsupportedPickleError('Missing STOP opcode');
  }

  private execute(opcode: number): void {
    switch (opcode) {
      case OPCODES.PROTO:
        this.protocol(this.reader.byte());
        return;
      case OPCODES.FRAME:
        this.reader.uint64();
        return;
      case OPCODES.MARK:
        this.marks.push(this.stack);
        this.stack = [];
        return;
      case OPCODES.POP:
        this.pop();
        return;
      case OPCODES.POP_MARK:
        this.popMark();
        return;
      case OPCODES.MEMOIZE:
        this.memo.set(this.memo.size, this.top());
        return;
      case OPCODES.BINPUT:
        this.memo.set(this.reader.byte(), this.top());
        return;
      case OPCODES.LONG_BINPUT:
        this.memo.set(this.reader.uint32(), this.top());
        return;
      case OPCODES.BINGET:
        this.push(this.memoValue(this.reader.byte()));
        return;
      case OPCODES.LONG_BINGET:
        this.push(this.memoValue(this.reader.uint32()));
        return;
      default:
        this.executeValue(opcode);
    }
  }

  private executeValue(opcode: number): void {
    switch (opcode) {
      case OPCODES.NONE:
        this.push(null);
        return;
      case OPCODES.NEWTRUE:
        this.push(true);
        return;
      case OPCODES.NEWFALSE:
        this.push(false);
        return;
      case OPCODES.BININT:
        this.push(this.reader.int32());
        return;
      case OPCODES.BININT1:
        this.push(this.reader.byte());
        return;
      case OPCODES.BININT2:
        this.push(this.reader.uint16());
        return;
      case OPCODES.LONG1:
        this.push(littleEndianSignedInteger(this.reader.slice(this.reader.byte())));
        return;
      case OPCODES.LONG4:
        this.push(littleEndianSignedInteger(this.reader.slice(this.reader.uint32())));
        return;
      case OPCODES.BINFLOAT:
        this.push(this.reader.float64());
        return;
      case OPCODES.SHORT_BINUNICODE:
        this.push(this.reader.text(this.reader.byte()));
        return;
      case OPCODES.BINUNICODE:
        this.push(this.reader.text(this.reader.uint32()));
        return;
      case OPCODES.BINUNICODE8:
        this.push(this.reader.text(this.reader.uint64()));
        return;
      case OPCODES.SHORT_BINBYTES:
        this.push(this.reader.slice(this.reader.byte()).slice());
        return;
      case OPCODES.BINBYTES:
        this.push(this.reader.slice(this.reader.uint32()).slice());
        return;
      default:
        this.executeCollection(opcode);
    }
  }

  private executeCollection(opcode: number): void {
    switch (opcode) {
      case OPCODES.EMPTY_LIST:
        this.push([]);
        return;
      case OPCODES.LIST:
        this.push(this.popMark().map((entry) => this.value(entry)));
        return;
      case OPCODES.APPEND:
        this.list(this.top(1)).push(this.value(this.pop()));
        return;
      case OPCODES.APPENDS: {
        const items = this.popMark().map((entry) => this.value(entry));
        this.list(this.top()).push(...items);
        return;
      }
      case OPCODES.EMPTY_TUPLE:
        this.push(Object.freeze([]));
        return;
      case OPCODES.TUPLE:
        this.push(Object.freeze(this.popMark().map((entry) => this.value(entry))));
        return;
      case OPCODES.TUPLE1:
      case OPCODES.TUPLE2:
      case OPCODES.TUPLE3:
        this.push(Object.freeze(this.popMany(opcode - OPCODES.TUPLE1 + 1)));
        return;
      case OPCODES.EMPTY_DICT:
        this.push(new Map());
        return;
      case OPCODES.DICT: {
        const dictionary = new Map<PickleValue, PickleValue>();
        this.setItems(dictionary, this.popMark());
        this.push(dictionary);
        return;
      }
      case OPCODES.SETITEM: {
        const [key, value] = this.popMany(2);
        this.dictionary(this.top()).set(key ?? null, value ?? null);
        return;
      }
      case OPCODES.SETITEMS: {
        const entries = this.popMark();
        this.setItems(this.dictionary(this.top()), entries);
        return;
      }
      case OPCODES.EMPTY_SET:
        this.push(new Set());
        return;
      case OPCODES.ADDITEMS: {
        const items = this.popMark().map((entry) => this.value(entry));
        const set = this.set(this.top());
        items.forEach((item) => set.add(item));
        return;
      }
      case OPCODES.FROZENSET:
        this.push(new Set(this.popMark().map((entry) => this.value(entry))));
        return;
      default:
        this.executeObject(opcode);
    }
  }

  private executeObject(opcode: number): void {
    switch (opcode) {
      case OPCODES.STACK_GLOBAL: {
        const [module, name] = this.popMany(2);
        if (typeof module !== 'string' || typeof name !== 'string') {
          throw new UnsupportedPickleError('Class names must be strings');
        }
        const qualifiedName = `${module}.${name}`;
        if (!isPermittedClass(qualifiedName)) {
          throw new UnsupportedPickleError(`Class not permitted: ${qualifiedName}`);
        }
        this.push(new PickleClass(qualifiedName));
        return;
      }
      case OPCODES.NEWOBJ:
      case OPCODES.REDUCE: {
        const args = this.pop();
        const target = this.pop();
        if (!(target instanceof PickleClass) || !Array.isArray(args)) {
          throw new UnsupportedPickleError('Object creation is permitted only for permitted classes');
        }
        this.push(new PickleObject(target.name, args));
        return;
      }
      case OPCODES.BUILD: {
        const state = this.value(this.pop());
        const target = this.top();
        if (!(target instanceof PickleObject)) {
          throw new UnsupportedPickleError('BUILD is permitted only for permitted classes');
        }
        target.state = state;
        return;
      }
      default:
        throw new UnsupportedPickleError(`Opcode not permitted: 0x${opcode.toString(16).padStart(2, '0')}`);
    }
  }

  private protocol(version: number): void {
    if (version > MAXIMUM_PROTOCOL) {
      throw new UnsupportedPickleError(`Pickle protocol not supported: ${version}`);
    }
  }

  private push(entry: StackEntry): void {
    this.stack.push(entry);
  }

  private pop(): StackEntry {
    if (this.stack.length === 0) {
      throw new UnsupportedPickleError('Stack underflow');
    }
    return this.stack.pop() as StackEntry;
  }

  private popMany(count: number): PickleValue[] {
    if (this.stack.length < count) {
      throw new UnsupportedPickleError('Stack underflow');
    }
    return this.stack.splice(this.stack.length - count, count).map((entry) => this.value(entry));
  }

  private popMark(): StackEntry[] {
    const items = this.stack;
    const previous = this.marks.pop();
    if (!previous) {
      throw new UnsupportedPickleError('Missing MARK');
    }
    this.stack = previous;
    return items;
  }

  private top(depth = 0): StackEntry {
    const entry = this.stack[this.stack.length - 1 - depth];
    if (entry === undefined) {
      throw new UnsupportedPickleError('Stack underflow');
    }
    return entry;
  }

  private memoValue(index: number): StackEntry {
    const entry = this.memo.get(index);
    if (entry === undefined) {
      throw new UnsupportedPickleError(`Unknown memo index: ${index}`);
    }
    return entry;
  }

  private value(entry: StackEntry): PickleValue {
    if (entry instanceof PickleClass) {
      throw new UnsupportedPickleError('A class is not permitted as a value');
    }
    return entry;
  }

  private list(entry: StackEntry): PickleValue[] {
    if (!Array.isArray(entry) || Object.isFrozen(entry)) {
      throw new UnsupportedPickleError('APPEND target is not a list');
    }
    return entry;
  }

  private dictionary(entry: StackEntry): Map<PickleValue, PickleValue> {
    if (!(entry instanceof Map)) {
      throw new UnsupportedPickleError('SETITEM target is not a dictionary');
    }
    return entry;
  }

  private set(entry: StackEntry): Set<PickleValue> {
    if (!(entry instanceof Set)) {
      throw new UnsupportedPickleError('ADDITEMS target is not a set');
    }
    return entry;
  }

  private setItems(dictionary: Map<PickleValue, PickleValue>, entries: StackEntry[]): void {
    if (entries.length % 2 !== 0) {
      throw new UnsupportedPickleError('Odd number of dictionary entries');
    }
    for (let index = 0; index < entries.length; index += 2) {
      dictionary.set(this.value(entries[index] ?? null), this.value(entries[index + 1] ?? null));
    }
  }
}
