import { dirname } from 'node:path';

const IN_MEMORY_DATABASE = ':memory:';

export function databaseDirectory(databaseUrl: string): string | null {
  const [databaseFile = ''] = databaseUrl.replace(/^file:/, '').split('?');
  if (databaseFile === '' || databaseFile === IN_MEMORY_DATABASE) {
    return null;
  }
  return dirname(databaseFile);
}
