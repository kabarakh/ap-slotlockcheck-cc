export interface ArchipelagoLink {
  origin: string;
  id: string;
}

const ALLOWED_HOSTS = new Set(['archipelago.gg', 'multiworld.gg', 'localhost', '127.0.0.1', '[::1]']);
const ALLOWED_HOST_SUFFIXES = ['.ionium.us'];
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

export function isAllowedArchipelagoOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase();
  return (
    ALLOWED_PROTOCOLS.has(url.protocol) &&
    (ALLOWED_HOSTS.has(host) || ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix)))
  );
}

export function parseArchipelagoLink(link: string, kind: 'room' | 'tracker'): ArchipelagoLink | undefined {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return undefined;
  }
  const segments = url.pathname.split('/').filter((segment) => segment.length > 0);
  const kindIndex = segments.lastIndexOf(kind);
  const id = kindIndex >= 0 ? segments[kindIndex + 1] : undefined;
  return id ? { origin: url.origin, id } : undefined;
}
