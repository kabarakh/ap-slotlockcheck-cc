import type { ReceivedItem, SlotIdentity } from '../lock/lock.types.js';
import type { ChecksHistoryPoint } from '../lock/unlock-time.logic.js';
import {
  slotLockSlotDataSchema,
  type RoomStatus,
  type SlotDataTracker,
  type TrackerData,
} from '../sources/archipelago/archipelago.schemas.js';
import type { CheeseChecksHistory, CheeseTracker } from '../sources/cheese/cheese.schemas.js';

export const SLOTLOCK_GAME = 'SlotLock';
const ITEM_ID_INDEX = 0;
const SENDER_INDEX = 2;
const FIRST_PLAYER_POSITION = 1;
const ALIAS_DISPLAY_PATTERN = /^(.+) \((.+)\)$/;

export interface ArchipelagoSlotNames {
  name: string | null;
  alias: string | null;
}

export interface SlotRecord {
  cheeseGameId: number;
  position: number;
  name: string;
  archipelagoName: string | null;
  game: string;
  discordUserId: string | null;
  discordName: string | null;
  checksDone: number;
  checksTotal: number;
  lastActivity: Date | null;
  trackerStatus: string;
  progressionStatus: string;
  completionStatus: string;
  availabilityStatus: string;
  notes: string;
  isSlotLock: boolean;
}

export function archipelagoNamesByPosition(
  roomStatus: RoomStatus | null,
  tracker: TrackerData | null,
): Map<number, ArchipelagoSlotNames> {
  const result = new Map<number, ArchipelagoSlotNames>();
  roomStatus?.players.forEach(([name], index) => {
    result.set(index + FIRST_PLAYER_POSITION, { name, alias: null });
  });
  for (const entry of tracker?.aliases ?? []) {
    const current = result.get(entry.player) ?? { name: null, alias: null };
    result.set(entry.player, { ...current, alias: entry.alias });
  }
  return result;
}

export function slotIdentity(slot: Pick<SlotRecord, 'position' | 'name' | 'archipelagoName'>): SlotIdentity {
  const display = ALIAS_DISPLAY_PATTERN.exec(slot.name);
  const aliases = [slot.archipelagoName, display?.[1], display?.[2]].filter(
    (alias): alias is string => typeof alias === 'string' && alias.length > 0,
  );
  return { position: slot.position, name: slot.name, aliases };
}

export function slotRecordsFromCheese(
  tracker: CheeseTracker,
  archipelagoNames: Map<number, ArchipelagoSlotNames> = new Map(),
): SlotRecord[] {
  return tracker.games.map((game) => ({
    cheeseGameId: game.id,
    position: game.position,
    name: game.name,
    archipelagoName: archipelagoNames.get(game.position)?.name ?? null,
    game: game.game,
    discordUserId: game.effective_discord_user_id ?? null,
    discordName: game.effective_discord_username ?? game.discord_username ?? null,
    checksDone: game.checks_done,
    checksTotal: game.checks_total,
    lastActivity: game.last_activity ? new Date(game.last_activity) : null,
    trackerStatus: game.tracker_status,
    progressionStatus: game.progression_status,
    completionStatus: game.completion_status,
    availabilityStatus: game.availability_status,
    notes: game.notes,
    isSlotLock: game.game === SLOTLOCK_GAME,
  }));
}

export function receivedItemsByPosition(
  tracker: TrackerData,
  positions: number[],
  itemNames: Map<number, string>,
): Map<number, ReceivedItem[]> {
  const result = new Map<number, ReceivedItem[]>();
  for (const position of positions) {
    const entry = tracker.player_items_received.find((received) => received.player === position);
    const items = (entry?.items ?? []).flatMap((item) => {
      const itemName = itemNames.get(item[ITEM_ID_INDEX]);
      return itemName === undefined ? [] : [{ itemName, senderPosition: item[SENDER_INDEX] }];
    });
    result.set(position, items);
  }
  return result;
}

export function lockedSlotNamesByPosition(slotData: SlotDataTracker, positions: number[]): Map<number, string[]> {
  const result = new Map<number, string[]>();
  for (const position of positions) {
    const entry = slotData.find((data) => data.player === position);
    const parsed = slotLockSlotDataSchema.safeParse(entry?.slot_data);
    if (parsed.success) {
      result.set(position, parsed.data.locked_slots);
    }
  }
  return result;
}

export function itemNamesById(itemNameToId: Record<string, number>): Map<number, string> {
  return new Map(Object.entries(itemNameToId).map(([name, id]) => [id, name]));
}

export function checksHistoryPoints(history: CheeseChecksHistory): ChecksHistoryPoint[] {
  return history.map((point) => ({ time: new Date(point.time), checksBySlotKey: point.slots }));
}
