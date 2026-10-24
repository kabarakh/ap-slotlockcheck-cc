import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { CookieOptions, Response } from 'express';
import { AppConfigService } from '../config/app-config.service.js';
import { SESSION_COOKIE, SESSION_LIFETIME_SECONDS, type AuthUser, type SessionPayload } from './auth.types.js';

@Injectable()
export class SessionService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  cookieOptions(maxAgeSeconds: number): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.isProduction,
      path: '/',
      maxAge: maxAgeSeconds * 1000,
    };
  }

  async startSession(response: Response, user: AuthUser): Promise<void> {
    const payload: SessionPayload = {
      sub: user.id,
      discordId: user.discordId,
      name: user.name,
      username: user.username,
      avatar: user.avatar,
    };
    const token = await this.jwt.signAsync(payload, { expiresIn: SESSION_LIFETIME_SECONDS });
    response.cookie(SESSION_COOKIE, token, this.cookieOptions(SESSION_LIFETIME_SECONDS));
  }

  endSession(response: Response): void {
    response.clearCookie(SESSION_COOKIE, { ...this.cookieOptions(0), maxAge: undefined });
  }

  async readSession(token: string | undefined): Promise<AuthUser | undefined> {
    if (!token) {
      return undefined;
    }
    try {
      const payload = await this.jwt.verifyAsync<SessionPayload>(token);
      return {
        id: payload.sub,
        discordId: payload.discordId,
        name: payload.name,
        username: payload.username,
        avatar: payload.avatar,
      };
    } catch {
      return undefined;
    }
  }
}
