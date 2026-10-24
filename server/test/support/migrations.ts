import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const MIGRATIONS_PATH = join(import.meta.dirname, '..', '..', 'prisma', 'migrations');

export function applyMigrations(databaseFile: string): void {
  const database = new Database(databaseFile);
  const migrations = readdirSync(MIGRATIONS_PATH)
    .filter((entry) => !entry.endsWith('.toml'))
    .sort();
  for (const migration of migrations) {
    database.exec(readFileSync(join(MIGRATIONS_PATH, migration, 'migration.sql'), 'utf8'));
  }
  database.close();
}
