import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type FixtureName =
  | 'cheese-tracker'
  | 'cheese-checks-history'
  | 'ap-room-status'
  | 'ap-tracker'
  | 'ap-static-tracker'
  | 'ap-slot-data'
  | 'ap-datapackage-slotlock';

export function loadFixture(name: FixtureName): unknown {
  return JSON.parse(readFileSync(join(import.meta.dirname, `${name}.json`), 'utf8'));
}

export type MultidataFixtureName = 'big-chill' | 'item-link' | 'other-room';

export function multidataFixturePath(name: MultidataFixtureName): string {
  return join(import.meta.dirname, `multidata-${name}.archipelago`);
}
