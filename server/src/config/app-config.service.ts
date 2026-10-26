import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from './environment.js';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  get<Key extends keyof Environment>(key: Key): Environment[Key] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get('NODE_ENV') === 'production';
  }

  get isTest(): boolean {
    return this.get('NODE_ENV') === 'test';
  }
}
