import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AppConfigService } from '../config/app-config.service.js';
import { SourceRequestError } from '../sources/http/source-errors.js';

const DISCORD_AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_USER_URL = 'https://discord.com/api/users/@me';

const tokenSchema = z.object({ access_token: z.string(), token_type: z.string() });
const discordUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  global_name: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
});

export type DiscordUser = z.infer<typeof discordUserSchema>;

@Injectable()
export class DiscordOAuthService {
  constructor(private readonly config: AppConfigService) {}

  authorizeUrl(state: string): string {
    const url = new URL(DISCORD_AUTHORIZE_URL);
    url.searchParams.set('client_id', this.config.get('DISCORD_CLIENT_ID'));
    url.searchParams.set('redirect_uri', this.config.get('DISCORD_CALLBACK_URL'));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'none');
    return url.toString();
  }

  async fetchUser(code: string): Promise<DiscordUser> {
    const tokenResponse = await fetch(DISCORD_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.config.get('DISCORD_CLIENT_ID'),
        client_secret: this.config.get('DISCORD_CLIENT_SECRET'),
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.get('DISCORD_CALLBACK_URL'),
      }),
      signal: AbortSignal.timeout(this.config.get('HTTP_TIMEOUT_SECONDS') * 1000),
    });
    if (!tokenResponse.ok) {
      throw new SourceRequestError(DISCORD_TOKEN_URL, tokenResponse.status, 'token exchange failed');
    }
    const token = tokenSchema.parse(await tokenResponse.json());
    const userResponse = await fetch(DISCORD_USER_URL, {
      headers: { authorization: `${token.token_type} ${token.access_token}` },
      signal: AbortSignal.timeout(this.config.get('HTTP_TIMEOUT_SECONDS') * 1000),
    });
    if (!userResponse.ok) {
      throw new SourceRequestError(DISCORD_USER_URL, userResponse.status, 'user request failed');
    }
    return discordUserSchema.parse(await userResponse.json());
  }
}
