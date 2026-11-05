import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';

import { AppConfigService } from '../config/app-config.service.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { databaseDirectory, databaseFile } from './database-directory.logic.js';

const AUTO_VACUUM_INCREMENTAL = 2;
const BUSY_TIMEOUT_MS = 10_000;

function sqliteAdapter(databaseUrl: string): PrismaBetterSqlite3 {
  const directory = databaseDirectory(databaseUrl);
  if (directory !== null) {
    mkdirSync(directory, { recursive: true });
  }
  return new PrismaBetterSqlite3({ url: databaseUrl });
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly databaseUrl: string;

  constructor(config: AppConfigService) {
    super({ adapter: sqliteAdapter(config.get('DATABASE_URL')) });
    this.databaseUrl = config.get('DATABASE_URL');
  }

  releaseFreePages(): number {
    const file = databaseFile(this.databaseUrl);
    if (file === null) {
      return 0;
    }
    const database = new Database(file, { timeout: BUSY_TIMEOUT_MS });
    try {
      if (database.pragma('auto_vacuum', { simple: true }) !== AUTO_VACUUM_INCREMENTAL) {
        return 0;
      }
      const freeBefore = database.pragma('freelist_count', { simple: true }) as number;
      database.exec('PRAGMA incremental_vacuum');
      return freeBefore - (database.pragma('freelist_count', { simple: true }) as number);
    } finally {
      database.close();
    }
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
