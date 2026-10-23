/** "1h 30m", "45m", "2h": the time-tracking display (no seconds). */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

/** "00:12:31": a running timer. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

/**
 * Reads what people type for a duration: "1h 30m", "1h30", "90m", "90",
 * "1.5h", "1:30". Returns seconds, or null when it is not a duration or not
 * between one minute and 24 hours.
 */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase().replace(',', '.');
  let minutes: number | null = null;
  const clock = /^(\d{1,2}):([0-5]\d)$/.exec(text);
  const units = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m?)?$/.exec(text);
  if (clock) minutes = Number(clock[1]) * 60 + Number(clock[2]);
  else if (units && (units[1] || units[2])) {
    // A bare number is minutes; after hours it is the minutes part.
    minutes = Number(units[1] ?? 0) * 60 + Number(units[2] ?? 0);
  }
  if (minutes === null || !Number.isFinite(minutes)) return null;
  const seconds = Math.round(minutes * 60);
  return seconds >= 60 && seconds <= 24 * 3600 ? seconds : null;
}
