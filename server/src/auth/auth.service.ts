import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth.types.js';

export interface LoginIdentity {
  discordId: string;
  name: string;
  username: string;
  avatar: string | null;
}

const RETURN_PATH_ORIGIN = 'https://return-path.invalid';

export function safeReturnPath(returnTo: unknown): string {
  if (
    typeof returnTo !== 'string' ||
    !returnTo.startsWith('/') ||
    returnTo.startsWith('//') ||
    returnTo.includes('\\') ||
    Array.from({ length: returnTo.length }, (_, index) => returnTo.charCodeAt(index)).some(
      (code) => code < 0x20 || code === 0x7f,
    )
  ) {
    return '/';
  }
  const target = new URL(returnTo, RETURN_PATH_ORIGIN);
  if (target.origin !== RETURN_PATH_ORIGIN) {
    return '/';
  }
  return target.pathname + target.search + target.hash;
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(identity: LoginIdentity): Promise<AuthUser> {
    const user = await this.prisma.user.upsert({
      where: { discordId: identity.discordId },
      create: { ...identity, lastLoginAt: new Date() },
      update: { name: identity.name, username: identity.username, avatar: identity.avatar, lastLoginAt: new Date() },
    });
    return { id: user.id, discordId: user.discordId, name: user.name, username: user.username, avatar: user.avatar };
  }
}
