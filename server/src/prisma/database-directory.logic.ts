import { dirname } from 'node:path';

const IN_MEMORY_DATABASE = ':memory:';

export function databaseFile(databaseUrl: string): string | null {
  const [file = ''] = databaseUrl.replace(/^file:/, '').split('?');
  return file === '' || file === IN_MEMORY_DATABASE ? null : file;
}

export function databaseDirectory(databaseUrl: string): string | null {
  const file = databaseFile(databaseUrl);
  return file === null ? null : dirname(file);
}
