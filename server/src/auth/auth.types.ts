import type { Request } from 'express';

export const SESSION_COOKIE = 'slotlock_session';
export const OAUTH_STATE_COOKIE = 'slotlock_oauth_state';
export const SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60;
export const OAUTH_STATE_LIFETIME_SECONDS = 10 * 60;

export interface AuthUser {
  id: number;
  discordId: string;
  name: string;
  username: string;
  avatar: string | null;
}

export interface SessionPayload {
  sub: number;
  discordId: string;
  name: string;
  username: string;
  avatar: string | null;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };
