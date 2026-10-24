import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { defineConfig } from 'prisma/config';

const environmentFile = `.env.${process.env.NODE_ENV ?? 'development'}`;
if (existsSync(environmentFile)) {
  loadEnvFile(environmentFile);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL ?? 'file:./data/development.db',
  },
});
