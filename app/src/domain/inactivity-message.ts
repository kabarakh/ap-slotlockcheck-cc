import type { SlotRow } from '@/api/types';
import type { InactivityLevel } from './inactivity';
import { buildPingMessages, type PingLineTexts } from './ping-messages';
import { hasAllChecks } from './summary';

export type InactivityLevelFilter = 'all' | 'yellow' | 'red';

export type ReminderLevel = Exclude<InactivityLevel, 'none'>;

export interface InactivityReminderEntry {
  slotName: string;
  game: string;
  discordUserId: string | null;
  discordName: string | null;
  level: ReminderLevel;
  hours: number;
  checksDone: number;
  checksTotal: number;
}

export interface InactivityReminderTexts extends PingLineTexts<InactivityReminderEntry> {
  title: string;
}

const LEVEL_MARKS: Record<ReminderLevel, string> = { yellow: '🟡', red: '🔴' };

export function formatInactiveTime(hours: number): string {
  const days = Math.floor(hours / 24);
  const restHours = Math.floor(hours % 24);
  return days > 0 ? `${days} d ${restHours} h` : `${restHours} h`;
}

const englishDetails = (entry: InactivityReminderEntry): string =>
  `${entry.slotName} (${entry.game}): inactive for ${formatInactiveTime(entry.hours)}, ` +
  `${entry.checksDone}/${entry.checksTotal} checks`;

export const ENGLISH_INACTIVITY_REMINDER_TEXTS: InactivityReminderTexts = {
  title: '# Inactive slots',
  line: (user, entry) => `${LEVEL_MARKS[entry.level]} ${user}, ${englishDetails(entry)}`,
  lineWithoutUser: (entry) => `${LEVEL_MARKS[entry.level]} ${englishDetails(entry)}`,
};

export function inactivityReminderEntries(
  slots: SlotRow[],
  hoursBySlotId: Map<number, number | null>,
  levelBySlotId: Map<number, InactivityLevel>,
  filter: InactivityLevelFilter,
): InactivityReminderEntry[] {
  return [...slots]
    .sort((a, b) => a.position - b.position)
    .flatMap((slot) => {
      const hours = hoursBySlotId.get(slot.id) ?? null;
      const level = levelBySlotId.get(slot.id) ?? 'none';
      if (hours === null || level === 'none' || (filter !== 'all' && filter !== level) || hasAllChecks(slot)) {
        return [];
      }
      return [
        {
          slotName: slot.name,
          game: slot.game,
          discordUserId: slot.discordUserId,
          discordName: slot.discordName,
          level,
          hours,
          checksDone: slot.checksDone,
          checksTotal: slot.checksTotal,
        },
      ];
    })
    .sort((a, b) => b.hours - a.hours);
}

export function buildInactivityReminderMessages(
  entries: InactivityReminderEntry[],
  pings: boolean,
  texts: InactivityReminderTexts,
): string[] {
  return buildPingMessages(entries, texts.title, pings, texts);
}
