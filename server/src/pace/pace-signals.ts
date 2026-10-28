import { z } from 'zod';

import { networkItemSchema, type NetworkItem } from '../sources/archipelago/archipelago.schemas.js';
import { progressionStatusSchema, type ProgressionStatus } from '../sources/cheese/cheese.schemas.js';

export type SignalSource = 'cheese' | 'ap_tracker';

export interface SignalSnapshot {
  source: SignalSource;
  validFrom: Date;
  payload: string;
}

export interface SignalSlot {
  position: number;
  cheeseGameId: number;
}

export interface SignalPeriod {
  from: Date;
  to: Date;
}

export interface PlayerPeriod extends SignalPeriod {
  discordUserId: string | null;
  discordName: string | null;
}

export interface StatusChange {
  time: Date;
  status: ProgressionStatus;
}

export interface SlotSignals {
  progressionItemTimes: Date[];
  bkPeriods: SignalPeriod[];
  playerPeriods: PlayerPeriod[];
  statusChanges: StatusChange[];
  signalsFrom: Date | null;
}

export type SnapshotReadResult = { read: true } | { read: false; error: SyntaxError | z.ZodError };

export interface SignalsReader {
  add(snapshot: SignalSnapshot): SnapshotReadResult;
  finish(now: Date): Map<number, SlotSignals>;
}

const BK_STATUSES: ReadonlySet<string> = new Set(['bk', 'soft_bk']);
const PROGRESSION_FLAG = 1;

const cheeseStatusSchema = z.object({
  games: z.array(
    z.object({
      id: z.number().int(),
      progression_status: z.string(),
      effective_discord_user_id: z.string().optional(),
      effective_discord_username: z.string().optional(),
      discord_username: z.string().optional(),
    }),
  ),
});

const receivedItemsSchema = z.object({
  player_items_received: z.array(z.object({ player: z.number().int(), items: z.array(networkItemSchema) })),
});

type CheeseStatus = z.infer<typeof cheeseStatusSchema>;
type ReceivedItems = z.infer<typeof receivedItemsSchema>;

type ParsedSnapshot = { source: 'cheese'; status: CheeseStatus } | { source: 'ap_tracker'; received: ReceivedItems };

interface OpenPlayerPeriod {
  from: Date;
  discordUserId: string | null;
  discordName: string | null;
}

function parseSnapshot(source: SignalSource, payload: string): ParsedSnapshot {
  const json: unknown = JSON.parse(payload);
  return source === 'cheese'
    ? { source, status: cheeseStatusSchema.parse(json) }
    : { source, received: receivedItemsSchema.parse(json) };
}

const isProgression = ([, , , flags]: NetworkItem): boolean => (flags & PROGRESSION_FLAG) === PROGRESSION_FLAG;

function listFor<T>(lists: Map<number, T[]>, key: number): T[] {
  const existing = lists.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const created: T[] = [];
  lists.set(key, created);
  return created;
}

export function createSignalsReader(slots: readonly SignalSlot[]): SignalsReader {
  const positions = new Set(slots.map((slot) => slot.position));
  const gameIds = new Set(slots.map((slot) => slot.cheeseGameId));
  const lastValidFrom = new Map<SignalSource, Date>();
  const receivedCounts = new Map<number, number>();
  const itemTimes = new Map<number, Date[]>();
  const closedBkPeriods = new Map<number, SignalPeriod[]>();
  const openBkStarts = new Map<number, Date>();
  const closedPlayerPeriods = new Map<number, PlayerPeriod[]>();
  const openPlayers = new Map<number, OpenPlayerPeriod>();
  const statusChanges = new Map<number, StatusChange[]>();
  const lastStatuses = new Map<number, ProgressionStatus>();
  let signalsFrom: Date | null = null;

  const readCheese = (status: CheeseStatus, validFrom: Date): void => {
    const games = status.games.filter((game) => gameIds.has(game.id));
    const bkGameIds = new Set(games.filter((game) => BK_STATUSES.has(game.progression_status)).map((game) => game.id));
    for (const [gameId, from] of openBkStarts) {
      if (!bkGameIds.has(gameId)) {
        listFor(closedBkPeriods, gameId).push({ from, to: validFrom });
        openBkStarts.delete(gameId);
      }
    }
    for (const gameId of bkGameIds) {
      if (!openBkStarts.has(gameId)) {
        openBkStarts.set(gameId, validFrom);
      }
    }
    for (const game of games) {
      const status = progressionStatusSchema.safeParse(game.progression_status);
      if (status.success && lastStatuses.get(game.id) !== status.data) {
        listFor(statusChanges, game.id).push({ time: validFrom, status: status.data });
        lastStatuses.set(game.id, status.data);
      }
      const discordUserId = game.effective_discord_user_id ?? null;
      const discordName = game.effective_discord_username ?? game.discord_username ?? null;
      const open = openPlayers.get(game.id);
      if (open !== undefined && open.discordUserId !== discordUserId) {
        listFor(closedPlayerPeriods, game.id).push({ ...open, to: validFrom });
      }
      openPlayers.set(game.id, {
        from: open !== undefined && open.discordUserId === discordUserId ? open.from : validFrom,
        discordUserId,
        discordName,
      });
    }
  };

  const readTracker = (received: ReceivedItems, validFrom: Date, isFirst: boolean): void => {
    for (const { player, items } of received.player_items_received) {
      const known = receivedCounts.get(player) ?? 0;
      if (!positions.has(player) || items.length <= known) {
        continue;
      }
      if (!isFirst) {
        listFor(itemTimes, player).push(
          ...items
            .slice(known)
            .filter(isProgression)
            .map(() => validFrom),
        );
      }
      receivedCounts.set(player, items.length);
    }
  };

  const add = ({ source, validFrom, payload }: SignalSnapshot): SnapshotReadResult => {
    const previous = lastValidFrom.get(source);
    if (previous !== undefined && validFrom < previous) {
      throw new Error(`Snapshots of the source ${source} are not sorted by time`);
    }
    let parsed: ParsedSnapshot;
    try {
      parsed = parseSnapshot(source, payload);
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof z.ZodError) {
        return { read: false, error };
      }
      throw error;
    }
    if (signalsFrom === null || validFrom < signalsFrom) {
      signalsFrom = validFrom;
    }
    if (parsed.source === 'cheese') {
      readCheese(parsed.status, validFrom);
    } else {
      readTracker(parsed.received, validFrom, previous === undefined);
    }
    lastValidFrom.set(source, validFrom);
    return { read: true };
  };

  const finish = (now: Date): Map<number, SlotSignals> =>
    new Map(
      slots.map((slot) => {
        const openFrom = openBkStarts.get(slot.cheeseGameId);
        const closed = closedBkPeriods.get(slot.cheeseGameId) ?? [];
        const openPlayer = openPlayers.get(slot.cheeseGameId);
        const closedPlayers = closedPlayerPeriods.get(slot.cheeseGameId) ?? [];
        return [
          slot.position,
          {
            progressionItemTimes: [...(itemTimes.get(slot.position) ?? [])],
            bkPeriods: openFrom === undefined ? [...closed] : [...closed, { from: openFrom, to: now }],
            playerPeriods:
              openPlayer === undefined ? [...closedPlayers] : [...closedPlayers, { ...openPlayer, to: now }],
            statusChanges: [...(statusChanges.get(slot.cheeseGameId) ?? [])],
            signalsFrom,
          },
        ];
      }),
    );

  return { add, finish };
}
