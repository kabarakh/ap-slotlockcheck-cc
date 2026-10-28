import { describe, expect, it } from 'vite-plus/test';

import type { InactivityLevel } from '../inactivity';
import {
  buildInactivityReminderMessages,
  ENGLISH_INACTIVITY_REMINDER_TEXTS as texts,
  formatInactiveTime,
  inactivityReminderEntries,
} from '../inactivity-message';
import { slotRow } from './fixtures';

const slots = [
  slotRow({ id: 1, position: 1, name: 'Yellow', discordUserId: '1', discordName: 'one', checksDone: 3 }),
  slotRow({ id: 2, position: 2, name: 'Red', discordUserId: '2', discordName: 'two', checksDone: 5 }),
  slotRow({ id: 3, position: 3, name: 'Fresh', discordUserId: '3', discordName: 'three' }),
  slotRow({ id: 4, position: 4, name: 'Done', discordUserId: '4', discordName: 'four', checksDone: 10 }),
  slotRow({ id: 5, position: 5, name: 'Goaled', discordUserId: '5', discordName: 'five' }),
];
const hours = new Map<number, number | null>([
  [1, 30],
  [2, 75.5],
  [3, 2],
  [4, 90],
  [5, null],
]);
const levels = new Map<number, InactivityLevel>([
  [1, 'yellow'],
  [2, 'red'],
  [3, 'none'],
  [4, 'red'],
  [5, 'none'],
]);

describe('formatInactiveTime', () => {
  it('writes hours and days with hours', () => {
    expect(formatInactiveTime(5.9)).toBe('5 h');
    expect(formatInactiveTime(75.5)).toBe('3 d 3 h');
  });
});

describe('inactivityReminderEntries', () => {
  it('takes yellow and red slots without all checks in the order of the longest inactivity', () => {
    expect(inactivityReminderEntries(slots, hours, levels, 'all').map((entry) => entry.slotName)).toEqual([
      'Red',
      'Yellow',
    ]);
  });

  it('filters the level', () => {
    expect(inactivityReminderEntries(slots, hours, levels, 'yellow').map((entry) => entry.slotName)).toEqual([
      'Yellow',
    ]);
    expect(inactivityReminderEntries(slots, hours, levels, 'red').map((entry) => entry.slotName)).toEqual(['Red']);
  });
});

describe('buildInactivityReminderMessages', () => {
  const entries = inactivityReminderEntries(slots, hours, levels, 'all');

  it('makes no message without entries', () => {
    expect(buildInactivityReminderMessages([], true, texts)).toEqual([]);
  });

  it('writes the level, the user, the game, the inactivity and the checks', () => {
    expect(buildInactivityReminderMessages(entries, true, texts)).toEqual([
      '# Inactive slots\n' +
        '🔴 <@2>, Red (Game): inactive for 3 d 3 h, 5/10 checks\n' +
        '🟡 <@1>, Yellow (Game): inactive for 1 d 6 h, 3/10 checks',
    ]);
  });

  it('uses the names without pings and only the slot without a Discord user', () => {
    const [message] = buildInactivityReminderMessages(
      [...entries, { ...entries[0]!, slotName: 'Nobody', discordUserId: null, discordName: null }],
      false,
      texts,
    );
    expect(message?.split('\n').slice(1)).toEqual([
      '🔴 two, Red (Game): inactive for 3 d 3 h, 5/10 checks',
      '🟡 one, Yellow (Game): inactive for 1 d 6 h, 3/10 checks',
      '🔴 Nobody (Game): inactive for 3 d 3 h, 5/10 checks',
    ]);
  });
});
