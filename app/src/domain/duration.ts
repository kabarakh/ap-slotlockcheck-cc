const MINUTES_PER_HOUR = 60;

export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / MINUTES_PER_HOUR);
  const rest = total % MINUTES_PER_HOUR;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

export function formatLongDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < MINUTES_PER_DAY) {
    return formatDuration(total);
  }
  const days = Math.floor(total / MINUTES_PER_DAY);
  const hours = Math.floor((total % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  return hours === 0 ? `${days} d` : `${days} d ${hours} h`;
}
