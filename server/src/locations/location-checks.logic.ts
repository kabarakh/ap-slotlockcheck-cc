export interface UncheckedLocation {
  id: number;
  finderPosition: number;
  locationId: bigint;
}

export interface PlayerChecks {
  player: number;
  locations: number[];
}

export function newlyCheckedLocationIds(unchecked: UncheckedLocation[], checks: PlayerChecks[]): number[] {
  const checkedByPosition = new Map<number, Set<bigint>>();
  for (const entry of checks) {
    const set = checkedByPosition.get(entry.player) ?? new Set<bigint>();
    entry.locations.forEach((locationId) => set.add(BigInt(locationId)));
    checkedByPosition.set(entry.player, set);
  }
  return unchecked
    .filter((location) => checkedByPosition.get(location.finderPosition)?.has(location.locationId) ?? false)
    .map((location) => location.id);
}
