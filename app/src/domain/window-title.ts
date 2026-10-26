export function windowTitle(roomTitle: string | null | undefined, appName: string): string {
  return roomTitle ? `${roomTitle} - ${appName}` : appName;
}
