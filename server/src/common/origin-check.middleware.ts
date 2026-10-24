import { ForbiddenException, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppConfigService } from '../config/app-config.service.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  private readonly allowedOrigin: string;

  constructor(config: AppConfigService) {
    this.allowedOrigin = new URL(config.get('PUBLIC_BASE_URL')).origin;
  }

  use(request: Request, _response: Response, next: NextFunction): void {
    const origin = request.headers.origin;
    if (!SAFE_METHODS.has(request.method) && origin !== undefined && origin !== this.allowedOrigin) {
      throw new ForbiddenException('ORIGIN_NOT_ALLOWED');
    }
    next();
  }
}
