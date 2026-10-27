import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export const developmentEnvFile = join(import.meta.dirname, '..', '..', 'server', '.env.development');

export function publicHostFromEnv(content: string): string {
  const baseUrl = parseEnv(content).PUBLIC_BASE_URL;
  if (baseUrl === undefined || !URL.canParse(baseUrl)) {
    throw new Error('PUBLIC_BASE_URL in server/.env.development is missing or not a URL.');
  }
  const host = new URL(baseUrl).hostname;
  if (LOCAL_HOSTS.has(host)) {
    throw new Error(`PUBLIC_BASE_URL in server/.env.development points to ${host}. Set it to the public domain.`);
  }
  return host;
}

export function publicDevHost(): string {
  if (!existsSync(developmentEnvFile)) {
    throw new Error(`${developmentEnvFile} does not exist.`);
  }
  return publicHostFromEnv(readFileSync(developmentEnvFile, 'utf8'));
}
