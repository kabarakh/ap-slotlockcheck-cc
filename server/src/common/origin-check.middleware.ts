import { ForbiddenException, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { AppConfigService } from '../config/app-config.service.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function allowedOrigins(publicBaseUrl: string, additionalOrigins: string | undefined): Set<string> {
  const extra = (additionalOrigins ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
    .map((origin) => new URL(origin).origin);
  return new Set([new URL(publicBaseUrl).origin, ...extra]);
}

@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  private readonly origins: Set<string>;

  constructor(config: AppConfigService) {
    this.origins = allowedOrigins(config.get('PUBLIC_BASE_URL'), config.get('ADDITIONAL_ORIGINS'));
  }

  use(request: Request, _response: Response, next: NextFunction): void {
    const origin = request.headers.origin;
    if (!SAFE_METHODS.has(request.method) && origin !== undefined && !this.origins.has(origin)) {
      throw new ForbiddenException('ORIGIN_NOT_ALLOWED');
    }
    next();
  }
}
