import { randomBytes } from 'node:crypto';
import { BadRequestException, Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { AppConfigService } from '../config/app-config.service.js';
import { CurrentUser } from './auth.decorators.js';
import { AuthService, safeReturnPath } from './auth.service.js';
import { OAUTH_STATE_COOKIE, OAUTH_STATE_LIFETIME_SECONDS, type AuthUser } from './auth.types.js';
import { DiscordOAuthService } from './discord-oauth.service.js';
import { SessionDto } from './dto/auth.dto.js';
import { SessionService } from './session.service.js';

interface OAuthState {
  nonce: string;
  returnTo: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly discord: DiscordOAuthService,
    private readonly sessions: SessionService,
    private readonly config: AppConfigService,
  ) {}

  @Get('discord')
  @ApiExcludeEndpoint()
  startLogin(@Query('returnTo') returnTo: unknown, @Res() response: Response): void {
    const state: OAuthState = { nonce: randomBytes(24).toString('base64url'), returnTo: safeReturnPath(returnTo) };
    response.cookie(
      OAUTH_STATE_COOKIE,
      JSON.stringify(state),
      this.sessions.cookieOptions(OAUTH_STATE_LIFETIME_SECONDS),
    );
    response.redirect(this.discord.authorizeUrl(state.nonce));
  }

  @Get('discord/callback')
  @ApiExcludeEndpoint()
  async completeLogin(
    @Query('code') code: unknown,
    @Query('state') nonce: unknown,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const state = this.readState(request);
    response.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
    if (!state || typeof code !== 'string' || nonce !== state.nonce) {
      throw new BadRequestException('Invalid login state');
    }
    const discordUser = await this.discord.fetchUser(code);
    const user = await this.auth.login({
      discordId: discordUser.id,
      name: discordUser.global_name ?? discordUser.username,
      username: discordUser.username,
      avatar: discordUser.avatar ?? null,
    });
    await this.sessions.startSession(response, user);
    response.redirect(new URL(state.returnTo, this.config.get('PUBLIC_BASE_URL')).toString());
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser | undefined): SessionDto {
    return { user: user ?? null };
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response): void {
    this.sessions.endSession(response);
  }

  private readState(request: Request): OAuthState | undefined {
    const raw = (request.cookies as Record<string, string> | undefined)?.[OAUTH_STATE_COOKIE];
    if (!raw) {
      return undefined;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<OAuthState>;
      return typeof parsed.nonce === 'string'
        ? { nonce: parsed.nonce, returnTo: safeReturnPath(parsed.returnTo) }
        : undefined;
    } catch {
      return undefined;
    }
  }
}
