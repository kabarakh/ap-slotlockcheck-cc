import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { mkdirSync } from 'node:fs';

import { AppConfigService } from '../config/app-config.service.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { databaseDirectory } from './database-directory.logic.js';

function sqliteAdapter(databaseUrl: string): PrismaBetterSqlite3 {
  const directory = databaseDirectory(databaseUrl);
  if (directory !== null) {
    mkdirSync(directory, { recursive: true });
  }
  return new PrismaBetterSqlite3({ url: databaseUrl });
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: AppConfigService) {
    super({ adapter: sqliteAdapter(config.get('DATABASE_URL')) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
