import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { AppConfigService } from '../config/app-config.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { DiscordOAuthService } from './discord-oauth.service.js';
import { JwtGuard } from './jwt.guard.js';
import { RoomRoleGuard } from './room-role.guard.js';
import { RoomRoleService } from './room-role.service.js';
import { SessionService } from './session.service.js';
import { TestAuthController } from './test-auth.controller.js';

const testControllers = process.env.NODE_ENV === 'test' ? [TestAuthController] : [];

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({ secret: config.get('JWT_SECRET') }),
    }),
  ],
  controllers: [AuthController, ...testControllers],
  providers: [
    AuthService,
    DiscordOAuthService,
    SessionService,
    RoomRoleService,
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RoomRoleGuard },
  ],
  exports: [RoomRoleService, SessionService],
})
export class AuthModule {}
