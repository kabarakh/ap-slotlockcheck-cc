import type { TimePoint } from './statistics-time';
import { playerKey } from './summary';
import type { MatrixPlayer } from './unlock-statistics';
import type { Blocker, ProgressionFlow, RoomDependencies, SlotRow } from '@/api/types';

export interface BlockerDetail {
  key: string;
  lockedName: string;
  lockedPlayer: string;
  finderName: string;
  finderPlayer: string;
  locationName: string;
  sphere: number;
}

export interface BlockingPlayer {
  key: string;
  name: string;
  blockedSlotCount: number;
  itemCount: number;
  blockedNames: string[];
  lowestSphere: number;
}

export interface BlockedSlot {
  slotId: number;
  name: string;
  discordName: string | null;
  copyCount: number;
  lowestSphere: number;
  finderNames: string[];
}

export interface BlockerStatistics {
  players: BlockingPlayer[];
  slots: BlockedSlot[];
  details: BlockerDetail[];
}

export interface ProgressionPlayer {
  key: string;
  name: string;
  openForOthers: number;
  totalForOthers: number;
  waitingOnOthers: number;
}

export interface ProgressionStatistics {
  players: ProgressionPlayer[];
  finders: MatrixPlayer[];
  receivers: MatrixPlayer[];
  openValues: number[][];
}

export interface SphereProgressCurve {
  points: TimePoint[];
  lowestOpenSphere: number | null;
}

function slotLookup(slots: SlotRow[]) {
  const byId = new Map(slots.map((slot) => [slot.id, slot]));
  return {
    slot: (id: number) => byId.get(id),
    name: (id: number) => byId.get(id)?.name ?? `#${id}`,
    player: (id: number) => byId.get(id)?.discordName ?? '',
  };
}

export function blockerStatistics(blockers: Blocker[], slots: SlotRow[]): BlockerStatistics {
  const lookup = slotLookup(slots);
  const players = new Map<string, BlockingPlayer & { blocked: Set<number> }>();
  const blocked = new Map<number, BlockedSlot & { finders: Set<string> }>();
  for (const blocker of blockers) {
    const finder = lookup.slot(blocker.finderSlotId);
    const key = finder ? playerKey(finder) : `slot:${blocker.finderSlotId}`;
    const player = players.get(key) ?? {
      key,
      name: finder?.discordName ?? lookup.name(blocker.finderSlotId),
      blockedSlotCount: 0,
      itemCount: 0,
      blockedNames: [],
      lowestSphere: blocker.sphere,
      blocked: new Set<number>(),
    };
    player.itemCount += 1;
    player.lowestSphere = Math.min(player.lowestSphere, blocker.sphere);
    if (!player.blocked.has(blocker.lockedSlotId)) {
      player.blocked.add(blocker.lockedSlotId);
      player.blockedNames.push(lookup.name(blocker.lockedSlotId));
    }
    players.set(key, player);

    const locked = blocked.get(blocker.lockedSlotId) ?? {
      slotId: blocker.lockedSlotId,
      name: lookup.name(blocker.lockedSlotId),
      discordName: lookup.slot(blocker.lockedSlotId)?.discordName ?? null,
      copyCount: 0,
      lowestSphere: blocker.sphere,
      finderNames: [],
      finders: new Set<string>(),
    };
    locked.copyCount += 1;
    locked.lowestSphere = Math.min(locked.lowestSphere, blocker.sphere);
    const finderName = lookup.name(blocker.finderSlotId);
    if (!locked.finders.has(finderName)) {
      locked.finders.add(finderName);
      locked.finderNames.push(finderName);
    }
    blocked.set(blocker.lockedSlotId, locked);
  }
  return {
    players: [...players.values()]
      .map(({ blocked: blockedIds, ...player }) => ({ ...player, blockedSlotCount: blockedIds.size }))
      .sort(
        (a, b) => b.blockedSlotCount - a.blockedSlotCount || b.itemCount - a.itemCount || a.name.localeCompare(b.name),
      ),
    slots: [...blocked.values()]
      .map(({ finders: _finders, ...slot }) => slot)
      .sort((a, b) => a.copyCount - b.copyCount || a.lowestSphere - b.lowestSphere || a.name.localeCompare(b.name)),
    details: blockers
      .map((blocker, index) => ({
        key: `${index}`,
        lockedName: lookup.name(blocker.lockedSlotId),
        lockedPlayer: lookup.player(blocker.lockedSlotId),
        finderName: lookup.name(blocker.finderSlotId),
        finderPlayer: lookup.player(blocker.finderSlotId),
        locationName: blocker.locationName,
        sphere: blocker.sphere,
      }))
      .sort((a, b) => a.sphere - b.sphere || a.lockedName.localeCompare(b.lockedName)),
  };
}

export function progressionStatistics(flow: ProgressionFlow[], slots: SlotRow[]): ProgressionStatistics {
  const playable = new Map(slots.filter((slot) => !slot.isSlotLock).map((slot) => [slot.id, slot]));
  const names = new Map<string, string>();
  const players = new Map<string, ProgressionPlayer>();
  const open = new Map<string, Map<string, number>>();
  const player = (key: string, name: string) => {
    names.set(key, name);
    const current = players.get(key) ?? { key, name, openForOthers: 0, totalForOthers: 0, waitingOnOthers: 0 };
    players.set(key, current);
    return current;
  };
  for (const row of flow) {
    const finder = playable.get(row.finderSlotId);
    const receiver = playable.get(row.receiverSlotId);
    if (finder === undefined || receiver === undefined) {
      continue;
    }
    const finderKey = playerKey(finder);
    const receiverKey = playerKey(receiver);
    const finderPlayer = player(finderKey, finder.discordName ?? '');
    const receiverPlayer = player(receiverKey, receiver.discordName ?? '');
    if (row.open > 0) {
      const cells = open.get(finderKey) ?? new Map<string, number>();
      cells.set(receiverKey, (cells.get(receiverKey) ?? 0) + row.open);
      open.set(finderKey, cells);
    }
    if (finderKey !== receiverKey) {
      finderPlayer.totalForOthers += row.total;
      finderPlayer.openForOthers += row.open;
      receiverPlayer.waitingOnOthers += row.open;
    }
  }
  const matrixPlayer = (key: string): MatrixPlayer => ({ key, name: names.get(key) ?? '' });
  const byName = (a: MatrixPlayer, b: MatrixPlayer) => a.name.localeCompare(b.name);
  const finders = [...open.keys()].map(matrixPlayer).sort(byName);
  const receivers = [...new Set([...open.values()].flatMap((cells) => [...cells.keys()]))]
    .map(matrixPlayer)
    .sort(byName);
  return {
    players: [...players.values()].sort(
      (a, b) =>
        b.openForOthers - a.openForOthers || b.waitingOnOthers - a.waitingOnOthers || a.name.localeCompare(b.name),
    ),
    finders,
    receivers,
    openValues: finders.map((finder) => receivers.map((receiver) => open.get(finder.key)?.get(receiver.key) ?? 0)),
  };
}

export function sphereProgressCurve(dependencies: RoomDependencies): SphereProgressCurve {
  const spheres = [...dependencies.spheres].sort((a, b) => a.sphere - b.sphere);
  const first = spheres[0];
  if (first === undefined) {
    return { points: [], lowestOpenSphere: null };
  }
  const points: TimePoint[] = [{ time: new Date(dependencies.seedUploadedAt).getTime(), value: first.sphere }];
  let latest = points[0]?.time ?? 0;
  for (const [index, sphere] of spheres.entries()) {
    if (sphere.doneAt === null) {
      points.push({ time: new Date(dependencies.calculatedAt).getTime(), value: sphere.sphere });
      return { points, lowestOpenSphere: sphere.sphere };
    }
    latest = Math.max(latest, new Date(sphere.doneAt).getTime());
    const next = spheres[index + 1];
    points.push({ time: latest, value: next?.sphere ?? sphere.sphere + 1 });
  }
  points.push({
    time: Math.max(latest, new Date(dependencies.calculatedAt).getTime()),
    value: points[points.length - 1]?.value ?? 0,
  });
  return { points, lowestOpenSphere: null };
}
