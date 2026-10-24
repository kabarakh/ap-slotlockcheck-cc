const MANUAL_GAME_PATTERN = /^Manual_(.+)_[^_]+$/;

function splitCamelCase(name: string): string {
  if (/\s/.test(name)) {
    return name;
  }
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

export function formatGameName(game: string): string {
  const manual = MANUAL_GAME_PATTERN.exec(game);
  return manual?.[1] ? `Manual: ${splitCamelCase(manual[1])}` : game;
}
