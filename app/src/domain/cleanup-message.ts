export const MAXIMUM_PINGS_PER_MESSAGE = 10;
export const MAXIMUM_MESSAGE_LENGTH = 2000;

export interface CleanupEntry {
  slotName: string;
  discordUserId: string | null;
  discordName: string | null;
  progression: number;
  useful: number;
  normal: number;
  trap: number;
}

export interface CleanupCounts {
  progression: number;
  filler: number;
  useful: number;
  normal: number;
  trap: number;
}

export interface CleanupTexts {
  title: (fromSphere: number, toSphere: number) => string;
  line: (user: string, slotName: string, counts: CleanupCounts) => string;
  lineWithoutUser: (slotName: string, counts: CleanupCounts) => string;
}

export interface CleanupOptions {
  fromSphere: number;
  toSphere: number;
  pings: boolean;
}

interface LineGroup {
  lines: string[];
  pings: number;
}

const countsOf = (entry: CleanupEntry): CleanupCounts => ({
  progression: entry.progression,
  filler: entry.useful + entry.normal + entry.trap,
  useful: entry.useful,
  normal: entry.normal,
  trap: entry.trap,
});

function groupsByUser(entries: CleanupEntry[], options: CleanupOptions, texts: CleanupTexts): LineGroup[] {
  const groups = new Map<string, CleanupEntry[]>();
  entries.forEach((entry, index) => {
    const key = entry.discordUserId ?? `slot:${index}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  });
  return [...groups.values()].map((userEntries) => {
    const userId = userEntries[0]?.discordUserId ?? null;
    const ping = options.pings && userId !== null;
    const lines = userEntries.map((entry, index) => {
      if (entry.discordUserId === null) {
        return texts.lineWithoutUser(entry.slotName, countsOf(entry));
      }
      const user = ping && index === 0 ? `<@${entry.discordUserId}>` : (entry.discordName ?? entry.discordUserId);
      return texts.line(user, entry.slotName, countsOf(entry));
    });
    return { lines, pings: ping ? 1 : 0 };
  });
}

export function buildCleanupMessages(entries: CleanupEntry[], options: CleanupOptions, texts: CleanupTexts): string[] {
  const title = texts.title(options.fromSphere, options.toSphere);
  const messages: string[][] = [];
  let current: string[] = [title];
  let pings = 0;
  const length = (lines: string[]) => lines.join('\n').length;
  const startNew = () => {
    messages.push(current);
    current = [title];
    pings = 0;
  };
  for (const group of groupsByUser(entries, options, texts)) {
    const tooManyPings = pings + group.pings > MAXIMUM_PINGS_PER_MESSAGE;
    const tooLong = length([...current, ...group.lines]) > MAXIMUM_MESSAGE_LENGTH;
    if (current.length > 1 && (tooManyPings || tooLong)) {
      startNew();
    }
    for (const line of group.lines) {
      if (current.length > 1 && length([...current, line]) > MAXIMUM_MESSAGE_LENGTH) {
        startNew();
      }
      current.push(line);
    }
    pings += group.pings;
  }
  if (current.length > 1) {
    messages.push(current);
  }
  return messages.map((lines) => lines.join('\n'));
}
