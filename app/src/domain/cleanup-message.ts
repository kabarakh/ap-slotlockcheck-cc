import { buildPingMessages } from './ping-messages';

export { MAXIMUM_MESSAGE_LENGTH, MAXIMUM_PINGS_PER_MESSAGE } from './ping-messages';

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

export const ENGLISH_CLEANUP_TEXTS: CleanupTexts = {
  title: (fromSphere, toSphere) =>
    fromSphere === toSphere ? `# Sphere ${fromSphere}` : `# Spheres ${fromSphere}–${toSphere}`,
  line: (user, slotName, counts) => `${user}, ${ENGLISH_CLEANUP_TEXTS.lineWithoutUser(slotName, counts)}`,
  lineWithoutUser: (slotName, counts) =>
    `${slotName}: ${counts.progression} progression, ${counts.filler} filler ` +
    `(${counts.useful} useful, ${counts.normal} normal, ${counts.trap} traps)`,
};

export interface CleanupOptions {
  fromSphere: number;
  toSphere: number;
  pings: boolean;
}

const countsOf = (entry: CleanupEntry): CleanupCounts => ({
  progression: entry.progression,
  filler: entry.useful + entry.normal + entry.trap,
  useful: entry.useful,
  normal: entry.normal,
  trap: entry.trap,
});

export function buildCleanupMessages(entries: CleanupEntry[], options: CleanupOptions, texts: CleanupTexts): string[] {
  return buildPingMessages(entries, texts.title(options.fromSphere, options.toSphere), options.pings, {
    line: (user, entry) => texts.line(user, entry.slotName, countsOf(entry)),
    lineWithoutUser: (entry) => texts.lineWithoutUser(entry.slotName, countsOf(entry)),
  });
}
