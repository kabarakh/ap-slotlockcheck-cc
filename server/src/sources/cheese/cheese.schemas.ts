import { z } from 'zod';

export const CHEESE_TRACKER_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export const trackerStatusSchema = z.enum(['disconnected', 'connected', 'ready', 'playing', 'goal_completed']);
export const progressionStatusSchema = z.enum(['unknown', 'unblocked', 'bk', 'go', 'soft_bk']);
export const completionStatusSchema = z.enum(['incomplete', 'all_checks', 'goal', 'done', 'released']);
export const availabilityStatusSchema = z.enum(['unknown', 'open', 'claimed', 'public']);

export const cheeseGameSchema = z.object({
  id: z.number().int(),
  position: z.number().int(),
  name: z.string(),
  game: z.string(),
  tracker_status: trackerStatusSchema,
  checks_done: z.number().int(),
  checks_total: z.number().int(),
  last_activity: z.iso.datetime({ offset: true }).optional(),
  discord_username: z.string().optional(),
  effective_discord_username: z.string().optional(),
  effective_discord_user_id: z.string().regex(/^\d+$/).optional(),
  claimed_by_ct_user_id: z.number().int().optional(),
  notes: z.string(),
  user_is_away: z.boolean(),
  availability_status: availabilityStatusSchema,
  completion_status: completionStatusSchema,
  progression_status: progressionStatusSchema,
});

export const cheeseTrackerSchema = z.object({
  tracker_id: z.string().regex(CHEESE_TRACKER_ID_PATTERN),
  title: z.string(),
  description: z.string().optional(),
  owner_ct_user_id: z.number().int().optional(),
  owner_discord_username: z.string().optional(),
  upstream_url: z.url(),
  room_link: z.string(),
  last_port: z.number().int().optional(),
  inactivity_threshold_yellow_hours: z.number().int().nonnegative(),
  inactivity_threshold_red_hours: z.number().int().nonnegative(),
  updated_at: z.iso.datetime({ offset: true }),
  games: z.array(cheeseGameSchema),
});

export const cheeseChecksHistorySchema = z.array(
  z.object({
    time: z.iso.datetime({ offset: true }),
    slots: z.record(z.string().regex(/^\d+$/), z.number().int()),
  }),
);

export type TrackerStatus = z.infer<typeof trackerStatusSchema>;
export type ProgressionStatus = z.infer<typeof progressionStatusSchema>;
export type CompletionStatus = z.infer<typeof completionStatusSchema>;
export type AvailabilityStatus = z.infer<typeof availabilityStatusSchema>;
export type CheeseGame = z.infer<typeof cheeseGameSchema>;
export type CheeseTracker = z.infer<typeof cheeseTrackerSchema>;
export type CheeseChecksHistory = z.infer<typeof cheeseChecksHistorySchema>;
