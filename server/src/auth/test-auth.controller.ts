import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';

import { AuthService } from './auth.service.js';
import { SessionDto, TestLoginDto } from './dto/auth.dto.js';
import { SessionService } from './session.service.js';

@ApiExcludeController()
@Controller('auth/test-login')
export class TestAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Post()
  @HttpCode(200)
  async login(@Body() body: TestLoginDto, @Res({ passthrough: true }) response: Response): Promise<SessionDto> {
    const user = await this.auth.login({
      discordId: body.discordId,
      name: body.name,
      username: body.username,
      avatar: null,
    });
    await this.sessions.startSession(response, user);
    return { user };
  }
}
