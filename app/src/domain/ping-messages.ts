export const MAXIMUM_PINGS_PER_MESSAGE = 10;
export const MAXIMUM_MESSAGE_LENGTH = 2000;

export interface PingEntry {
  discordUserId: string | null;
  discordName: string | null;
}

export interface PingLineTexts<T extends PingEntry> {
  line: (user: string, entry: T) => string;
  lineWithoutUser: (entry: T) => string;
}

interface LineGroup {
  lines: string[];
  pings: number;
}

function groupsByUser<T extends PingEntry>(entries: T[], pings: boolean, texts: PingLineTexts<T>): LineGroup[] {
  const groups = new Map<string, T[]>();
  entries.forEach((entry, index) => {
    const key = entry.discordUserId ?? `slot:${index}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  });
  return [...groups.values()].map((userEntries) => {
    const userId = userEntries[0]?.discordUserId ?? null;
    const ping = pings && userId !== null;
    const lines = userEntries.map((entry, index) => {
      if (entry.discordUserId === null) {
        return texts.lineWithoutUser(entry);
      }
      const user = ping && index === 0 ? `<@${entry.discordUserId}>` : (entry.discordName ?? entry.discordUserId);
      return texts.line(user, entry);
    });
    return { lines, pings: ping ? 1 : 0 };
  });
}

export function buildPingMessages<T extends PingEntry>(
  entries: T[],
  title: string,
  pings: boolean,
  texts: PingLineTexts<T>,
): string[] {
  const messages: string[][] = [];
  let current: string[] = [title];
  let pingCount = 0;
  const length = (lines: string[]) => lines.join('\n').length;
  const startNew = () => {
    messages.push(current);
    current = [title];
    pingCount = 0;
  };
  for (const group of groupsByUser(entries, pings, texts)) {
    const tooManyPings = pingCount + group.pings > MAXIMUM_PINGS_PER_MESSAGE;
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
    pingCount += group.pings;
  }
  if (current.length > 1) {
    messages.push(current);
  }
  return messages.map((lines) => lines.join('\n'));
}
