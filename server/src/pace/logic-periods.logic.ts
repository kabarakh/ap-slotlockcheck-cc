import type { SignalPeriod } from './pace-signals.js';

export interface LogicLocation {
  sphere: number;
  checkedAt: Date | null;
}

export interface NoLogicInput {
  ownLocations: LogicLocation[];
  progressionItems: LogicLocation[];
  unreachableSphere: number;
  from: Date;
  to: Date;
}

const isOpenAt = (location: LogicLocation, time: Date): boolean =>
  location.checkedAt === null || location.checkedAt > time;

function countBySphere(locations: LogicLocation[], time: Date): Map<number, number> {
  const counts = new Map<number, number>();
  for (const location of locations) {
    if (isOpenAt(location, time)) {
      counts.set(location.sphere, (counts.get(location.sphere) ?? 0) + 1);
    }
  }
  return counts;
}

function decrement(counts: Map<number, number>, sphere: number): void {
  const count = (counts.get(sphere) ?? 0) - 1;
  if (count > 0) {
    counts.set(sphere, count);
  } else {
    counts.delete(sphere);
  }
}

export function noLogicPeriods(input: NoLogicInput): SignalPeriod[] {
  const own = input.ownLocations.filter((location) => location.sphere < input.unreachableSphere);
  if (own.length === 0 || input.from >= input.to) {
    return [];
  }
  const ownLowestSphere = Math.min(...own.map((location) => location.sphere));
  const openOwn = countBySphere(own, input.from);
  const openItems = countBySphere(input.progressionItems, input.from);
  const laterChecks = [
    ...own.map((location) => ({ location, counts: openOwn })),
    ...input.progressionItems.map((location) => ({ location, counts: openItems })),
  ]
    .filter(
      ({ location }) => location.checkedAt !== null && location.checkedAt > input.from && location.checkedAt < input.to,
    )
    .sort((a, b) => (a.location.checkedAt?.getTime() ?? 0) - (b.location.checkedAt?.getTime() ?? 0));

  const inLogic = (): number => {
    const limit = Math.max(Math.min(...openItems.keys()), ownLowestSphere);
    let count = 0;
    for (const [sphere, open] of openOwn) {
      if (sphere <= limit) {
        count += open;
      }
    }
    return count;
  };

  const periods: SignalPeriod[] = [];
  let periodStart: Date | null = inLogic() === 0 ? input.from : null;
  let index = 0;
  while (index < laterChecks.length) {
    const time = laterChecks[index].location.checkedAt ?? input.from;
    while (index < laterChecks.length && laterChecks[index].location.checkedAt?.getTime() === time.getTime()) {
      decrement(laterChecks[index].counts, laterChecks[index].location.sphere);
      index += 1;
    }
    const empty = inLogic() === 0;
    if (empty && periodStart === null) {
      periodStart = time;
    } else if (!empty && periodStart !== null) {
      periods.push({ from: periodStart, to: time });
      periodStart = null;
    }
  }
  if (periodStart !== null) {
    periods.push({ from: periodStart, to: input.to });
  }
  return periods;
}
