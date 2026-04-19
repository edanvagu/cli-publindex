export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min < 60) return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
  const hours = Math.floor(min / 60);
  const minRest = min % 60;
  return minRest > 0 ? `${hours}h ${minRest}m` : `${hours}h`;
}
