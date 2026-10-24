import { z } from 'zod';

const teamPlayer = { team: z.number().int(), player: z.number().int() };

export const networkItemSchema = z.tuple([z.number().int(), z.number().int(), z.number().int(), z.number().int()]);

export const roomStatusSchema = z.object({
  tracker: z.string(),
  players: z.array(z.tuple([z.string(), z.string()])),
  last_port: z.number().int(),
  last_activity: z.string(),
  timeout: z.number().int(),
});

export const trackerDataSchema = z.object({
  aliases: z.array(z.object({ ...teamPlayer, alias: z.string().nullable() })).default([]),
  player_items_received: z.array(z.object({ ...teamPlayer, items: z.array(networkItemSchema) })),
  player_checks_done: z.array(z.object({ ...teamPlayer, locations: z.array(z.number().int()) })),
  activity_timers: z.array(z.object({ ...teamPlayer, time: z.string().nullable() })),
  player_status: z.array(z.object({ ...teamPlayer, status: z.number().int() })),
});

export const staticTrackerSchema = z.object({
  datapackage: z.record(z.string(), z.object({ checksum: z.string() })),
  player_locations_total: z.array(z.object({ ...teamPlayer, total_locations: z.number().int() })),
  player_game: z.array(z.object({ ...teamPlayer, game: z.string() })),
});

export const slotDataTrackerSchema = z.array(
  z.object({ player: z.number().int(), slot_data: z.record(z.string(), z.unknown()) }),
);

export const slotLockSlotDataSchema = z.object({ locked_slots: z.array(z.string()) });

export const datapackageSchema = z.object({
  checksum: z.string().optional(),
  item_name_to_id: z.record(z.string(), z.number().int()),
});

export type NetworkItem = z.infer<typeof networkItemSchema>;
export type RoomStatus = z.infer<typeof roomStatusSchema>;
export type TrackerData = z.infer<typeof trackerDataSchema>;
export type StaticTracker = z.infer<typeof staticTrackerSchema>;
export type SlotDataTracker = z.infer<typeof slotDataTrackerSchema>;
export type Datapackage = z.infer<typeof datapackageSchema>;
