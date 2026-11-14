import { z } from 'zod';

import { progressionStatusSchema, type ProgressionStatus } from '../sources/cheese/cheese.schemas.js';
import { DATA_GAP_MINUTES } from './pace.constants.js';

export type SignalSource = 'cheese';

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
  bkPeriods: SignalPeriod[];
  playerPeriods: PlayerPeriod[];
  statusChanges: StatusChange[];
  signalsFrom: Date | null;
}

export type SnapshotReadResult = { read: true } | { read: false; error: SyntaxError | z.ZodError };

export interface SignalsReader {
  add(snapshot: SignalSnapshot): SnapshotReadResult;
  finish(now: Date): Map<number, SlotSignals>;
  state(): SignalsState;
}

interface OpenPlayerPeriod {
  from: Date;
  discordUserId: string | null;
  discordName: string | null;
}

export interface SignalsState {
  signalsFrom: Date | null;
  lastValidFrom: Map<SignalSource, Date>;
  lastSyncRunAt: Date | null;
  syncGaps: SignalPeriod[];
  closedBkPeriods: Map<number, SignalPeriod[]>;
  openBkStarts: Map<number, Date>;
  closedPlayerPeriods: Map<number, PlayerPeriod[]>;
  openPlayers: Map<number, OpenPlayerPeriod>;
  statusChanges: Map<number, StatusChange[]>;
  lastStatuses: Map<number, ProgressionStatus>;
}

const BK_STATUSES: ReadonlySet<string> = new Set(['bk', 'soft_bk']);
const MS_PER_MINUTE = 60_000;

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

type CheeseStatus = z.infer<typeof cheeseStatusSchema>;

function listFor<T>(lists: Map<number, T[]>, key: number): T[] {
  const existing = lists.get(key);
  if (existing !== undefined) {
    return existing;
  }
  const created: T[] = [];
  lists.set(key, created);
  return created;
}

const isoDate = z.iso.datetime().transform((value) => new Date(value));
const entriesOf = <K, V>(key: z.ZodType<K>, value: z.ZodType<V>) =>
  z.array(z.tuple([key, value])).transform((entries) => new Map(entries));
const periodSchema = z.object({ from: isoDate, to: isoDate });
const playerSchema = z.object({ discordUserId: z.string().nullable(), discordName: z.string().nullable() });
const gameId = z.number().int();

const signalsStateSchema = z.object({
  signalsFrom: isoDate.nullable(),
  lastValidFrom: entriesOf(z.string(), isoDate).transform(
    (entries) => new Map([...entries].filter((entry): entry is [SignalSource, Date] => entry[0] === 'cheese')),
  ),
  lastSyncRunAt: isoDate.nullable().default(null),
  syncGaps: z.array(periodSchema).default([]),
  closedBkPeriods: entriesOf(gameId, z.array(periodSchema)),
  openBkStarts: entriesOf(gameId, isoDate),
  closedPlayerPeriods: entriesOf(gameId, z.array(periodSchema.extend(playerSchema.shape))),
  openPlayers: entriesOf(gameId, playerSchema.extend({ from: isoDate })),
  statusChanges: entriesOf(gameId, z.array(z.object({ time: isoDate, status: progressionStatusSchema }))),
  lastStatuses: entriesOf(gameId, progressionStatusSchema),
});

export function emptySignalsState(): SignalsState {
  return {
    signalsFrom: null,
    lastValidFrom: new Map(),
    lastSyncRunAt: null,
    syncGaps: [],
    closedBkPeriods: new Map(),
    openBkStarts: new Map(),
    closedPlayerPeriods: new Map(),
    openPlayers: new Map(),
    statusChanges: new Map(),
    lastStatuses: new Map(),
  };
}

export function serializeSignalsState(state: SignalsState): string {
  return JSON.stringify(state, (_key, value: unknown) => (value instanceof Map ? [...value] : value));
}

export function parseSignalsState(json: string): SignalsState {
  return signalsStateSchema.parse(JSON.parse(json));
}

function readCheese(state: SignalsState, status: CheeseStatus, validFrom: Date): void {
  const bkGameIds = new Set(
    status.games.filter((game) => BK_STATUSES.has(game.progression_status)).map((game) => game.id),
  );
  for (const [gameId, from] of state.openBkStarts) {
    if (!bkGameIds.has(gameId)) {
      listFor(state.closedBkPeriods, gameId).push({ from, to: validFrom });
      state.openBkStarts.delete(gameId);
    }
  }
  for (const gameId of bkGameIds) {
    if (!state.openBkStarts.has(gameId)) {
      state.openBkStarts.set(gameId, validFrom);
    }
  }
  for (const game of status.games) {
    const progression = progressionStatusSchema.safeParse(game.progression_status);
    if (progression.success && state.lastStatuses.get(game.id) !== progression.data) {
      listFor(state.statusChanges, game.id).push({ time: validFrom, status: progression.data });
      state.lastStatuses.set(game.id, progression.data);
    }
    const discordUserId = game.effective_discord_user_id ?? null;
    const discordName = game.effective_discord_username ?? game.discord_username ?? null;
    const open = state.openPlayers.get(game.id);
    if (open !== undefined && open.discordUserId !== discordUserId) {
      listFor(state.closedPlayerPeriods, game.id).push({ ...open, to: validFrom });
    }
    state.openPlayers.set(game.id, {
      from: open !== undefined && open.discordUserId === discordUserId ? open.from : validFrom,
      discordUserId,
      discordName,
    });
  }
}

export function readSyncRuns(state: SignalsState, startTimes: Date[], gapMinutes: number): void {
  const sorted = startTimes
    .filter((time) => state.lastSyncRunAt === null || time > state.lastSyncRunAt)
    .sort((a, b) => a.getTime() - b.getTime());
  for (const time of sorted) {
    const previous = state.lastSyncRunAt;
    if (previous !== null && time.getTime() - previous.getTime() > gapMinutes * MS_PER_MINUTE) {
      state.syncGaps.push({ from: previous, to: time });
    }
    state.lastSyncRunAt = time;
  }
}

export function syncGaps(state: SignalsState, now: Date): SignalPeriod[] {
  const last = state.lastSyncRunAt;
  if (last === null || now.getTime() - last.getTime() <= DATA_GAP_MINUTES * MS_PER_MINUTE) {
    return [...state.syncGaps];
  }
  return [...state.syncGaps, { from: last, to: now }];
}

export function readSignalSnapshot(
  state: SignalsState,
  { source, validFrom, payload }: SignalSnapshot,
): SnapshotReadResult {
  const previous = state.lastValidFrom.get(source);
  if (previous !== undefined && validFrom < previous) {
    throw new Error(`Snapshots of the source ${source} are not sorted by time`);
  }
  let status: CheeseStatus;
  try {
    status = cheeseStatusSchema.parse(JSON.parse(payload));
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      return { read: false, error };
    }
    throw error;
  }
  if (state.signalsFrom === null || validFrom < state.signalsFrom) {
    state.signalsFrom = validFrom;
  }
  readCheese(state, status, validFrom);
  state.lastValidFrom.set(source, validFrom);
  return { read: true };
}

export function finishSignals(state: SignalsState, slots: readonly SignalSlot[], now: Date): Map<number, SlotSignals> {
  return new Map(
    slots.map((slot) => {
      const openFrom = state.openBkStarts.get(slot.cheeseGameId);
      const closed = state.closedBkPeriods.get(slot.cheeseGameId) ?? [];
      const openPlayer = state.openPlayers.get(slot.cheeseGameId);
      const closedPlayers = state.closedPlayerPeriods.get(slot.cheeseGameId) ?? [];
      return [
        slot.position,
        {
          bkPeriods: openFrom === undefined ? [...closed] : [...closed, { from: openFrom, to: now }],
          playerPeriods: openPlayer === undefined ? [...closedPlayers] : [...closedPlayers, { ...openPlayer, to: now }],
          statusChanges: [...(state.statusChanges.get(slot.cheeseGameId) ?? [])],
          signalsFrom: state.signalsFrom,
        },
      ];
    }),
  );
}

export function createSignalsReader(
  slots: readonly SignalSlot[],
  state: SignalsState = emptySignalsState(),
): SignalsReader {
  return {
    add: (snapshot) => readSignalSnapshot(state, snapshot),
    finish: (now) => finishSignals(state, slots, now),
    state: () => state,
  };
}
