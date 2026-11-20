export function windowTitle(parts: (string | null | undefined)[], appName: string): string {
  return [...parts.filter((part): part is string => Boolean(part)), appName].join(' - ');
}
