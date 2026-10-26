import type { Prisma } from '../generated/prisma/client.js';
import type { ReleaseMode } from './dto/archipelago-admin.dto.js';

export function websocketAddress(origin: string, port: number): string {
  const url = new URL(origin);
  const protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
  return `${protocol}//${url.hostname}:${port}`;
}

const RELEASE_MODE_FILTERS: Record<ReleaseMode, Prisma.SeedLocationWhereInput> = {
  all: {},
  filler: { itemType: { not: 'progression' } },
  marked: { fillerMarkedAt: { not: null } },
};

export function releaseWhere(
  roomId: number,
  fromSphere: number,
  toSphere: number,
  mode: ReleaseMode,
): Prisma.SeedLocationWhereInput {
  return {
    roomId,
    checked: false,
    sphere: { gte: Math.min(fromSphere, toSphere), lte: Math.max(fromSphere, toSphere) },
    ...RELEASE_MODE_FILTERS[mode],
  };
}

export function slotCommandName(slot: { name: string; archipelagoName: string | null }): string {
  return slot.archipelagoName ?? slot.name;
}
