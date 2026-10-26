import { describe, expect, it } from 'vitest';
import {
  buildCleanupMessages,
  ENGLISH_CLEANUP_TEXTS as texts,
  MAXIMUM_MESSAGE_LENGTH,
  type CleanupEntry,
} from '../cleanup-message';

const entry = (overrides: Partial<CleanupEntry>): CleanupEntry => ({
  slotName: 'Slot',
  discordUserId: '1',
  discordName: 'user',
  progression: 3,
  useful: 2,
  normal: 3,
  trap: 0,
  ...overrides,
});

const users = (count: number): CleanupEntry[] =>
  Array.from({ length: count }, (_, index) =>
    entry({ slotName: `Slot${index}`, discordUserId: String(index + 1), discordName: `user${index}` }),
  );

const pingCount = (message: string): number => (message.match(/<@\d+>/g) ?? []).length;

describe('buildCleanupMessages', () => {
  it('makes no message without entries', () => {
    expect(buildCleanupMessages([], { fromSphere: 3, toSphere: 3, pings: true }, texts)).toEqual([]);
  });

  it('writes the title and one line for each slot', () => {
    expect(
      buildCleanupMessages(
        [entry({ slotName: 'HerbMC', discordUserId: '123', discordName: 'Kabarakh' })],
        { fromSphere: 36, toSphere: 36, pings: true },
        texts,
      ),
    ).toEqual(['# Sphere 36\n<@123>, HerbMC: 3 progression, 5 filler (2 useful, 3 normal, 0 traps)']);
  });

  it('pings a user with more slots only one time and keeps the lines together', () => {
    const [message] = buildCleanupMessages(
      [
        entry({ slotName: 'A', discordUserId: '7', discordName: 'seven' }),
        entry({ slotName: 'B', discordUserId: '8', discordName: 'eight' }),
        entry({ slotName: 'C', discordUserId: '7', discordName: 'seven' }),
      ],
      { fromSphere: 1, toSphere: 2, pings: true },
      texts,
    );
    expect(message?.split('\n').map((line) => line.split(':')[0])).toEqual([
      '# Spheres 1–2',
      '<@7>, A',
      'seven, C',
      '<@8>, B',
    ]);
  });

  it('uses the names without pings and the slot name for slots without a Discord user', () => {
    const [message] = buildCleanupMessages(
      [entry({ discordName: 'named' }), entry({ slotName: 'Lonely', discordUserId: null, discordName: null })],
      { fromSphere: 0, toSphere: 0, pings: false },
      texts,
    );
    expect(message).toContain('named, Slot:');
    expect(message).toContain('Lonely: 3 progression, 5 filler');
    expect(pingCount(message ?? '')).toBe(0);
  });

  it.each([
    [10, [10]],
    [11, [10, 1]],
    [25, [10, 10, 5]],
  ])('puts at most 10 pings into one message (%i users)', (count, expected) => {
    const messages = buildCleanupMessages(users(count), { fromSphere: 0, toSphere: 0, pings: true }, texts);
    expect(messages.map(pingCount)).toEqual(expected);
    expect(messages.every((message) => message.startsWith('# Sphere 0\n'))).toBe(true);
  });

  it('starts a new message before the length limit of Discord', () => {
    const long = Array.from({ length: 40 }, (_, index) =>
      entry({ slotName: `${'X'.repeat(80)}${index}`, discordUserId: null, discordName: null }),
    );
    const messages = buildCleanupMessages(long, { fromSphere: 0, toSphere: 0, pings: true }, texts);
    expect(messages.length).toBeGreaterThan(1);
    expect(messages.every((message) => message.length <= MAXIMUM_MESSAGE_LENGTH)).toBe(true);
    expect(
      messages
        .join('\n')
        .split('\n')
        .filter((line) => !line.startsWith('#')),
    ).toHaveLength(40);
  });
});
