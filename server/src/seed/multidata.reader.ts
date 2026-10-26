import { inflateSync } from 'node:zlib';

import { itemTypeFromFlags, type ItemType } from './item-type.js';
import { multidataSchema, type MultidataRoot } from './multidata.schemas.js';
import { decodePickle, UnsupportedPickleError } from './pickle/pickle-decoder.js';

export const SUPPORTED_MULTIDATA_VERSIONS = [3];
export const MAXIMUM_MULTIDATA_SIZE = 500 * 1024 * 1024;
const PLAYER_SLOT_TYPE = 0b01;

export type MultidataErrorCode =
  | 'UNSUPPORTED_MULTIDATA_VERSION'
  | 'MULTIDATA_TOO_LARGE'
  | 'INVALID_MULTIDATA'
  | 'INVALID_ZIP'
  | 'ZIP_WITHOUT_MULTIDATA'
  | 'ZIP_WITH_MORE_MULTIDATA';

export class MultidataFormatError extends Error {
  constructor(
    readonly code: MultidataErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'MultidataFormatError';
  }
}

export interface MultidataPlayer {
  number: number;
  name: string;
  game: string;
}

export interface MultidataLocation {
  finder: number;
  receiver: number;
  receiverName: string;
  locationId: number;
  locationName: string;
  itemId: number;
  itemName: string;
  itemType: ItemType;
  sphere: number;
}

export interface MultidataGame {
  checksum: string | null;
  itemNameToId: Map<string, number>;
  locationNameToId: Map<string, number>;
}

export interface MultidataContent {
  seedName: string;
  archipelagoVersion: string;
  players: MultidataPlayer[];
  locations: MultidataLocation[];
  sphereCount: number;
  unreachableLocationCount: number;
  games: Map<string, MultidataGame>;
}

function decompress(file: Uint8Array, maximumSize: number): Uint8Array {
  const version = file[0];
  if (version === undefined || !SUPPORTED_MULTIDATA_VERSIONS.includes(version)) {
    throw new MultidataFormatError('UNSUPPORTED_MULTIDATA_VERSION', `Unsupported multidata version: ${version}`);
  }
  try {
    return new Uint8Array(inflateSync(file.subarray(1), { maxOutputLength: maximumSize }));
  } catch (error) {
    if (error instanceof RangeError) {
      throw new MultidataFormatError('MULTIDATA_TOO_LARGE', 'The multidata is too large');
    }
    throw new MultidataFormatError('INVALID_MULTIDATA', 'The multidata is not valid zlib data');
  }
}

function parseRoot(bytes: Uint8Array): MultidataRoot {
  let decoded: unknown;
  try {
    decoded = decodePickle(bytes);
  } catch (error) {
    if (error instanceof UnsupportedPickleError) {
      throw new MultidataFormatError('INVALID_MULTIDATA', error.message);
    }
    throw error;
  }
  const result = multidataSchema.safeParse(decoded);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new MultidataFormatError('INVALID_MULTIDATA', `Invalid multidata at ${issue?.path.join('.') ?? ''}`);
  }
  return result.data;
}

function invert(nameToId: Map<string, number>): Map<number, string> {
  return new Map([...nameToId].map(([name, id]) => [id, name]));
}

function sphereKey(player: number, locationId: number): string {
  return `${player}:${locationId}`;
}

function sphereByLocation(root: MultidataRoot): Map<string, number> {
  const result = new Map<string, number>();
  root.spheres.forEach((sphere, index) => {
    for (const [player, locationIds] of sphere) {
      for (const locationId of locationIds) {
        result.set(sphereKey(player, locationId), index);
      }
    }
  });
  return result;
}

function toContent(root: MultidataRoot): MultidataContent {
  const games = new Map<string, MultidataGame>(
    [...root.datapackage].map(([game, data]) => [
      game,
      {
        checksum: data.checksum ?? null,
        itemNameToId: data.item_name_to_id,
        locationNameToId: data.location_name_to_id,
      },
    ]),
  );
  const itemNames = new Map([...games].map(([game, data]) => [game, invert(data.itemNameToId)]));
  const locationNames = new Map([...games].map(([game, data]) => [game, invert(data.locationNameToId)]));
  const slots = root.slot_info;
  const spheres = sphereByLocation(root);
  const unreachableSphere = root.spheres.length;
  let unreachableLocationCount = 0;
  const locations: MultidataLocation[] = [];
  for (const [finder, finderLocations] of root.locations) {
    const finderGame = slots.get(finder)?.game ?? '';
    for (const [locationId, [itemId, receiver, flags]] of finderLocations) {
      const receiverSlot = slots.get(receiver);
      const sphere = spheres.get(sphereKey(finder, locationId));
      if (sphere === undefined) {
        unreachableLocationCount += 1;
      }
      locations.push({
        finder,
        receiver,
        receiverName: receiverSlot?.name ?? String(receiver),
        locationId,
        locationName: locationNames.get(finderGame)?.get(locationId) ?? String(locationId),
        itemId,
        itemName: itemNames.get(receiverSlot?.game ?? '')?.get(itemId) ?? String(itemId),
        itemType: itemTypeFromFlags(flags),
        sphere: sphere ?? unreachableSphere,
      });
    }
  }
  return {
    seedName: root.seed_name,
    archipelagoVersion: root.version.join('.'),
    players: [...slots]
      .filter(([, slot]) => (slot.type & PLAYER_SLOT_TYPE) !== 0)
      .map(([number, slot]) => ({ number, name: slot.name, game: slot.game }))
      .sort((a, b) => a.number - b.number),
    locations,
    sphereCount: root.spheres.length,
    unreachableLocationCount,
    games,
  };
}

export function readMultidata(file: Uint8Array, maximumSize = MAXIMUM_MULTIDATA_SIZE): MultidataContent {
  return toContent(parseRoot(decompress(file, maximumSize)));
}
