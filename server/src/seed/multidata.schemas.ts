import { z } from 'zod';
import { PickleObject } from './pickle/pickle-decoder.js';

const integer = z.number().int();

const stringKeyedRecord = (value: unknown): unknown =>
  value instanceof Map && [...value.keys()].every((key) => typeof key === 'string') ? Object.fromEntries(value) : value;

const pickleObject = (className: string) =>
  z.instanceof(PickleObject).refine((object) => object.className === className, { message: `Expected ${className}` });

const slotTypeSchema = pickleObject('NetUtils.SlotType')
  .transform((object): unknown[] => [...object.args])
  .pipe(z.tuple([integer]))
  .transform(([flags]) => flags);

export const networkSlotSchema = pickleObject('NetUtils.NetworkSlot')
  .transform((object): unknown[] => [...object.args])
  .pipe(z.tuple([z.string(), z.string(), slotTypeSchema], z.unknown()))
  .transform(([name, game, type]) => ({ name, game, type }));

const gameDataSchema = z.preprocess(
  stringKeyedRecord,
  z.object({
    checksum: z.string().optional(),
    item_name_to_id: z.map(z.string(), integer),
    location_name_to_id: z.map(z.string(), integer),
  }),
);

export const multidataSchema = z.preprocess(
  stringKeyedRecord,
  z.object({
    seed_name: z.string(),
    version: z.tuple([integer, integer, integer]),
    slot_info: z.map(integer, networkSlotSchema),
    locations: z.map(integer, z.map(integer, z.tuple([integer, integer, integer]))),
    spheres: z.array(z.map(integer, z.set(integer))),
    datapackage: z.map(z.string(), gameDataSchema),
  }),
);

export type MultidataRoot = z.infer<typeof multidataSchema>;
