import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from './auth.types.js';

export interface LoginIdentity {
  discordId: string;
  name: string;
  username: string;
  avatar: string | null;
}

export function safeReturnPath(returnTo: unknown): string {
  if (
    typeof returnTo !== 'string' ||
    !returnTo.startsWith('/') ||
    returnTo.startsWith('//') ||
    returnTo.includes('\\')
  ) {
    return '/';
  }
  return returnTo;
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
