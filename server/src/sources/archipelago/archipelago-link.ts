export interface ArchipelagoLink {
  origin: string;
  id: string;
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
