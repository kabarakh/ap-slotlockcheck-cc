import type { IncomingHttpHeaders } from 'node:http';

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const first = raw?.split(',')[0]?.trim();
  return first ? first : undefined;
}

export function loginOrigin(
  headers: IncomingHttpHeaders,
  protocol: string,
  allowedOrigins: Set<string>,
  publicBaseUrl: string,
): string {
  const proto = firstHeaderValue(headers['x-forwarded-proto']) ?? protocol;
  const host = firstHeaderValue(headers['x-forwarded-host']) ?? firstHeaderValue(headers.host);
  const candidate = host ? `${proto}://${host}` : undefined;
  return candidate && allowedOrigins.has(candidate) ? candidate : new URL(publicBaseUrl).origin;
}

export function callbackUrlFor(origin: string, configuredCallbackUrl: string): string {
  return new URL(new URL(configuredCallbackUrl).pathname, origin).toString();
}
