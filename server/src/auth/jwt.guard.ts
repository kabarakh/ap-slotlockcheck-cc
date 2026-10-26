import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRE_LOGIN_KEY } from './auth.decorators.js';
import { SESSION_COOKIE, type AuthenticatedRequest } from './auth.types.js';
import { SessionService } from './session.service.js';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookies = request.cookies as Record<string, string> | undefined;
    request.user = await this.sessions.readSession(cookies?.[SESSION_COOKIE]);
    const loginRequired = this.reflector.getAllAndOverride<boolean>(REQUIRE_LOGIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (loginRequired && !request.user) {
      throw new UnauthorizedException('Login required');
    }
    return true;
  }
}
